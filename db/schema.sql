-- ============================================================================
--  ロジポケ配車Agent ― 理想データモデル DDL（PostgreSQL 14+）
-- ============================================================================
--  設計の根拠は docs/ideal-data-model.md、運行層の詳細は
--  docs/operation-layer-deep-dive.md を参照。
--
--  ■ なぜ PostgreSQL か（バックエンド未定のため標準的な選択）
--    - ネイティブ ENUM / 配列 / JSONB / 範囲型 + 除外制約（EXCLUDE）が使え、
--      「同一ドライバー/車両の時間重複禁止」を DB レベルで保証できる（旧 validateAssignment）。
--    - 他RDBへ移植する場合の差分は §移植メモ（ファイル末尾）に記載。
--
--  ■ 適用順序：このファイル単体で頭から流せる（依存順に並べ、循環FKは ALTER で後付け）。
--    psql -v ON_ERROR_STOP=1 -f db/schema.sql
--    続けて初期データは db/seed_from_prototype.sql
-- ============================================================================

BEGIN;

-- ── 拡張 ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- EXCLUDE 制約（text= + range&&）に必要
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()（ID補助）

-- ============================================================================
--  0. 列挙型（status/種別を文字列散在から enum へ。旧コードの日本語文字列を集約）
-- ============================================================================
CREATE TYPE company_kind     AS ENUM ('client','partner');                 -- 荷主/協力会社
CREATE TYPE client_type      AS ENUM ('regular','spot','charter','special','chilled'); -- 定期/スポット/チャーター/特殊/冷蔵
CREATE TYPE temp_zone        AS ENUM ('ambient','chilled','frozen');       -- 常温/冷蔵/冷凍
CREATE TYPE packaging        AS ENUM ('pallet','case','bulk','roll','container','other');
CREATE TYPE body_type        AS ENUM ('flatbed','wing','box','reefer','freezer'); -- 平/ウィング/箱/冷蔵/冷凍
CREATE TYPE vehicle_status   AS ENUM ('active','maintenance','retired');    -- active/整備中(=旧休車)/廃車
CREATE TYPE license_class    AS ENUM ('medium','large','trailer');         -- 中型/大型/けん引
CREATE TYPE employment_status AS ENUM ('active','leave','retired');
CREATE TYPE user_role        AS ENUM ('dispatcher','manager','admin','viewer');
CREATE TYPE channel          AS ENUM ('ai_phone','phone','mail','web','manual');
CREATE TYPE reception_status AS ENUM ('pending','reviewing','confirmed','rejected','duplicated');
CREATE TYPE ai_confidence    AS ENUM ('high','medium','low');
CREATE TYPE order_pattern    AS ENUM ('regular','spot','charter','special','multidrop');
CREATE TYPE order_priority   AS ENUM ('normal','urgent');                  -- 通常/緊急
CREATE TYPE order_status     AS ENUM ('draft','unassigned','assigning','assigned','in_transit','completed','invoiced','cancelled');
CREATE TYPE requirement_type AS ENUM ('tail_lift','forklift','temp_control','time_strict','berth_reserved','attendant','multi_drop','other');
CREATE TYPE trip_tab         AS ENUM ('planning','confirmed');             -- 配車計画/確定
CREATE TYPE trip_shape       AS ENUM ('single','relay','co_load','multiday','return'); -- 単一/中継/相積み/日跨ぎ/戻り回送
CREATE TYPE trip_status      AS ENUM ('planned','confirmed','in_progress','completed','cancelled'); -- 待機/確定/運行中/完了/取消
CREATE TYPE leg_role         AS ENUM ('pickup_delivery','preload','transport','delivery','relay');
CREATE TYPE handoff_type     AS ENUM ('overnight_park','driver_swap','depot_transfer','parallel'); -- 夜間駐車/交代/デポ転送/並行
CREATE TYPE stop_kind        AS ENUM ('pickup','dropoff','relay_handoff','depot','rest');
CREATE TYPE compliance_overall AS ENUM ('ok','warn','violation');          -- 適合/要確認/違反
CREATE TYPE compliance_rule  AS ENUM ('daily_drive','duty_hours','weekly_cap','interval_rest','continuous_drive','break_rule'); -- 改善基準告示6項目
CREATE TYPE fare_source      AS ENUM ('manual','recurring_route','ai_suggested');
CREATE TYPE surcharge_kind   AS ENUM ('fuel','toll','waiting','highway','special');
CREATE TYPE invoice_status   AS ENUM ('draft','issued','paid','overdue');
CREATE TYPE frequency_type   AS ENUM ('weekly','monthly','daily');
CREATE TYPE ownership_subject AS ENUM ('driver','trip');
CREATE TYPE lock_subject     AS ENUM ('trip','leg','order');
CREATE TYPE audit_action     AS ENUM ('create','update','delete','status_change','reassign');
CREATE TYPE notification_kind AS ENUM ('new_reception','compliance_warn','deadline_risk','reassigned');

-- ── 共通：updated_at 自動更新トリガ ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  NEW.version    := COALESCE(OLD.version, 0) + 1;   -- 楽観ロック
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- ============================================================================
--  1. マスタ層
-- ============================================================================

-- 地点（値オブジェクトを正規化。旧：from/to/area の生住所文字列を構造化 → 課題C5）
-- base_id は「解決された自社拠点」（旧 resolveBaseIdByAlias の結果）。FKは下で後付け（base と循環のため）。
CREATE TABLE location (
  id           TEXT PRIMARY KEY,
  raw          TEXT NOT NULL,                 -- 入力された生住所
  prefecture   TEXT,
  city         TEXT,
  detail       TEXT,
  postal_code  TEXT,
  geo_lat      NUMERIC(9,6),
  geo_lng      NUMERIC(9,6),
  base_id      TEXT                           -- → base.id（FK後付け）
);

-- 拠点（旧 bases。良い設計なので踏襲）
CREATE TABLE base (
  id           TEXT PRIMARY KEY,              -- 旧 "B001"
  name         TEXT NOT NULL,                 -- 川口拠点
  region       TEXT NOT NULL,                 -- 関東
  location_id  TEXT REFERENCES location(id),
  aliases      TEXT[] NOT NULL DEFAULT '{}',  -- ["川口市","川口",...] 住所解決用
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  version      INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE location ADD CONSTRAINT fk_location_base
  FOREIGN KEY (base_id) REFERENCES base(id) ON DELETE SET NULL;

-- 拠点間距離（旧 _baseDistanceMap。対称。アプリは (min,max) で1行=双方向に正規化）
CREATE TABLE base_distance (
  from_base_id TEXT NOT NULL REFERENCES base(id) ON DELETE CASCADE,
  to_base_id   TEXT NOT NULL REFERENCES base(id) ON DELETE CASCADE,
  distance_km  NUMERIC(6,1) NOT NULL CHECK (distance_km >= 0),
  est_drive_min INTEGER CHECK (est_drive_min >= 0),
  PRIMARY KEY (from_base_id, to_base_id),
  CHECK (from_base_id <= to_base_id)          -- 対称重複を防ぐ（小さいID側を from に正規化）
);

-- 請求フォーマット（旧 defaultFormatId "FMT-001" の参照先を実体化）
CREATE TABLE billing_format (
  id           TEXT PRIMARY KEY,              -- 旧 "FMT-001"
  name         TEXT NOT NULL,
  template     JSONB NOT NULL DEFAULT '{}',   -- 列定義・レイアウト等
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  version      INTEGER NOT NULL DEFAULT 1
);

-- 社内ユーザー / 配車担当（旧 TEAM_MEMBERS。"user" は予約語のため app_user）
CREATE TABLE app_user (
  id           TEXT PRIMARY KEY,              -- 旧 "me","u2"...
  name         TEXT NOT NULL,
  role         user_role NOT NULL DEFAULT 'dispatcher',
  color        TEXT,                          -- UI表示色
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  version      INTEGER NOT NULL DEFAULT 1
);

-- 車格マスタ（旧 allVehicleTypes / TYPES を実体化 → 課題C3/C4）
CREATE TABLE vehicle_type (
  id           TEXT PRIMARY KEY,              -- 例 "vtype_4t_wing"
  name         TEXT NOT NULL,                 -- "4tウィング"
  body_type    body_type NOT NULL,
  ton_class    NUMERIC(4,1) NOT NULL,         -- 4
  max_load_kg  INTEGER NOT NULL CHECK (max_load_kg > 0),
  temp_zones   temp_zone[] NOT NULL DEFAULT '{ambient}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  version      INTEGER NOT NULL DEFAULT 1
);

-- 会社（荷主・協力会社を統一。旧 clientMasterData + partnerMasterData）
CREATE TABLE company (
  id               TEXT PRIMARY KEY,          -- 旧 "CL-001" / "PT-001"
  kind             company_kind NOT NULL,
  name             TEXT NOT NULL,
  location_id      TEXT REFERENCES location(id),
  contact_name     TEXT,
  contact_tel      TEXT,
  contact_email    TEXT,
  client_type      client_type,              -- 荷主のみ（旧 type）
  billing_format_id TEXT REFERENCES billing_format(id),
  legacy_ids       TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       TEXT REFERENCES app_user(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       TEXT REFERENCES app_user(id),
  version          INTEGER NOT NULL DEFAULT 1,
  -- 荷主は client_type 必須、協力会社は不可
  CHECK ( (kind = 'client') = (client_type IS NOT NULL) )
);

-- 協力会社が対応できる車格（旧 partner.vehicleTypes[] の正規化）
CREATE TABLE company_vehicle_type (
  company_id      TEXT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  vehicle_type_id TEXT NOT NULL REFERENCES vehicle_type(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, vehicle_type_id)
);

-- 車両（旧 vehicles。ドライバーを持たない＝良い設計を踏襲 → 課題C2）
CREATE TABLE vehicle (
  id              TEXT PRIMARY KEY,           -- 旧 "V1382"
  plate_label     TEXT NOT NULL,              -- 表示名 "車両1382"
  vehicle_type_id TEXT NOT NULL REFERENCES vehicle_type(id),
  home_base_id    TEXT NOT NULL REFERENCES base(id),
  status          vehicle_status NOT NULL DEFAULT 'active',  -- maintenance=旧"休車"
  legacy_ids      TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

-- 車両の所属拠点（旧 vehicle.baseIds[]。長距離車は複数）
CREATE TABLE vehicle_base (
  vehicle_id   TEXT NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  base_id      TEXT NOT NULL REFERENCES base(id) ON DELETE CASCADE,
  PRIMARY KEY (vehicle_id, base_id)
);

-- ドライバー（旧 drivers。車両を持たない＝良い設計を踏襲。旧 "V1382" 互換は legacy_ids → 課題C2）
CREATE TABLE driver (
  id                 TEXT PRIMARY KEY,        -- 旧 "D001"
  name               TEXT NOT NULL,
  licenses           license_class[] NOT NULL DEFAULT '{}',
  is_partner         BOOLEAN NOT NULL DEFAULT false,
  partner_company_id TEXT REFERENCES company(id),  -- 協力会社所属なら（旧 partnerName を正規化）
  home_base_id       TEXT REFERENCES base(id),     -- 協力会社は NULL 可
  default_owner_id   TEXT REFERENCES app_user(id), -- 既定の配車担当
  employment         employment_status NOT NULL DEFAULT 'active',
  legacy_ids         TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  version            INTEGER NOT NULL DEFAULT 1,
  -- 協力会社ドライバーは partner_company_id 必須・拠点なし（旧 baseId:null）
  CHECK ( (is_partner) = (partner_company_id IS NOT NULL) )
);

-- 定期便マスタ（旧 TEIKI_SAMPLES。Order 自動生成のテンプレート）
CREATE TABLE recurring_route (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,                       -- "東京〜大阪 定期便"
  pattern             order_pattern NOT NULL DEFAULT 'regular',
  client_id           TEXT NOT NULL REFERENCES company(id),-- 旧 client(名前)→ID参照
  origin_location_id  TEXT NOT NULL REFERENCES location(id),
  destination_location_id TEXT NOT NULL REFERENCES location(id),
  frequency_type      frequency_type NOT NULL,
  days_of_week        SMALLINT[] NOT NULL DEFAULT '{}',    -- 0=日..6=土
  active_from         DATE NOT NULL,
  active_to           DATE,
  standard_fare_jpy   BIGINT NOT NULL CHECK (standard_fare_jpy >= 0), -- 旧 fare:'85000'文字列→整数
  preferred_vehicle_type_id TEXT REFERENCES vehicle_type(id),
  auto_create_order   BOOLEAN NOT NULL DEFAULT false,      -- 旧 autoReflect
  details             JSONB NOT NULL DEFAULT '{}',         -- 旧 detail{}
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1,
  CHECK (active_to IS NULL OR active_to >= active_from)
);

-- ============================================================================
--  2. 受付層（AI電話受付 → 案件化。旧 localStorage キュー INTAKE_QUEUE_KEY を置換）
-- ============================================================================
CREATE TABLE reception (
  id            TEXT PRIMARY KEY,             -- サーバ発番（旧 "AI"+日時 の衝突を排除 → 課題C1）
  channel       channel NOT NULL,             -- 旧 ch + source
  received_at   TIMESTAMPTZ NOT NULL,
  status        reception_status NOT NULL DEFAULT 'pending',
  transcript    TEXT,                         -- 通話文字起こし全文
  audio_url     TEXT,
  -- AI抽出（確定前の候補。名寄せ前の生テキストや信頼度を含む）
  ai_confidence ai_confidence,                -- 旧 aiResult.confidence
  matched_client_id TEXT REFERENCES company(id),
  suggested_vehicle_type_id TEXT REFERENCES vehicle_type(id),
  extraction    JSONB NOT NULL DEFAULT '{}',  -- 旧 intake 全文（origin/destination/cargo/conditions の生抽出）
  order_id      TEXT,                         -- 案件化された場合（FK後付け：order と循環）
  reviewed_by   TEXT REFERENCES app_user(id),
  legacy_ids    TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  version       INTEGER NOT NULL DEFAULT 1
);

-- ============================================================================
--  3. 案件層（旧 allCasesMasterData/unprocessed/processing/processedCases を1テーブルに統合 → 課題C7）
-- ============================================================================
CREATE TABLE transport_order (
  id                 TEXT PRIMARY KEY,        -- サーバ発番で統一（旧 "20240524001" 等）→ 課題C1
  order_no           TEXT NOT NULL UNIQUE,    -- 人が読む受注番号（表示用）
  client_id          TEXT NOT NULL REFERENCES company(id),  -- 旧 client(名前)→ID参照 → 課題C3
  reception_id       TEXT REFERENCES reception(id),
  recurring_route_id TEXT REFERENCES recurring_route(id),

  origin_location_id      TEXT NOT NULL REFERENCES location(id),
  destination_location_id TEXT NOT NULL REFERENCES location(id),

  -- 荷（旧 goods:"パレット / 800kg / 常温" を分解 → 課題C4）
  cargo_description  TEXT,
  cargo_packaging    packaging NOT NULL DEFAULT 'other',
  cargo_package_count INTEGER,
  cargo_weight_kg    INTEGER NOT NULL DEFAULT 0 CHECK (cargo_weight_kg >= 0),
  cargo_volume_m3    NUMERIC(7,2),
  cargo_temp_zone    temp_zone NOT NULL DEFAULT 'ambient',
  cargo_hazardous    BOOLEAN NOT NULL DEFAULT false,
  cargo_notes        TEXT,

  -- 時間枠（旧 deadline:"05/25 AM指定"/"本日中" を構造化 → 課題C5）
  pickup_earliest    TIMESTAMPTZ,
  pickup_latest      TIMESTAMPTZ,
  pickup_label       TEXT,
  pickup_strict      BOOLEAN NOT NULL DEFAULT false,
  delivery_earliest  TIMESTAMPTZ,
  delivery_latest    TIMESTAMPTZ,
  delivery_label     TEXT,
  delivery_strict    BOOLEAN NOT NULL DEFAULT false,

  pattern            order_pattern NOT NULL DEFAULT 'spot',  -- 旧 casePattern
  priority           order_priority NOT NULL DEFAULT 'normal',
  status             order_status NOT NULL DEFAULT 'draft',
  channel            channel NOT NULL DEFAULT 'manual',

  primary_assignment_id TEXT,                  -- 主担当アサイン（FK後付け）
  fare_id            TEXT,                     -- 運賃（FK後付け）
  completed_at       TIMESTAMPTZ,              -- 「過去」判定は status ではなく期間で（旧 過去 → completed + completed_at）
  legacy_ids         TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         TEXT REFERENCES app_user(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         TEXT REFERENCES app_user(id),
  version            INTEGER NOT NULL DEFAULT 1,
  CHECK (pickup_latest   IS NULL OR pickup_earliest   IS NULL OR pickup_latest   >= pickup_earliest),
  CHECK (delivery_latest IS NULL OR delivery_earliest IS NULL OR delivery_latest >= delivery_earliest)
);
-- 受付→案件 の循環FK
ALTER TABLE reception ADD CONSTRAINT fk_reception_order
  FOREIGN KEY (order_id) REFERENCES transport_order(id) ON DELETE SET NULL;

-- 案件の状態遷移イベント（誰がいつ何を。旧 status 文字列の上書きを履歴化 → 課題C7）
CREATE TABLE order_event (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES transport_order(id) ON DELETE CASCADE,
  from_status order_status,
  to_status   order_status NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  by_user_id  TEXT REFERENCES app_user(id),
  reason      TEXT
);

-- 特殊条件（旧 conditions 自由文字列 → タイプ化で検索/マッチング可能に）
CREATE TABLE order_requirement (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES transport_order(id) ON DELETE CASCADE,
  type        requirement_type NOT NULL,
  value       TEXT
);

-- ============================================================================
--  4. 運行層（Trip / Leg / Stop / Assignment）★単一情報源（SSoT）
--     旧 scheduleData + dndDrivers + assignments + case.legs[] を統合 → 課題C6
--     詳細は docs/operation-layer-deep-dive.md
-- ============================================================================

-- 運行（1台のドライバー×車両が担う、1つ以上の区間からなる仕事のまとまり）
CREATE TABLE trip (
  id            TEXT PRIMARY KEY,             -- 旧 jobId "J-...-RELAY"
  tab           trip_tab NOT NULL DEFAULT 'planning',  -- planning/confirmed
  service_date  DATE NOT NULL,                -- 基準日（複数日運行は leg 側で表現）
  status        trip_status NOT NULL DEFAULT 'planned',
  shape         trip_shape NOT NULL DEFAULT 'single',  -- 単一/中継/相積み/日跨ぎ/戻り回送
  multi_reasons TEXT[] NOT NULL DEFAULT '{}', -- 旧 multiReasons（"改善基準対策"等）
  owner_id      TEXT REFERENCES app_user(id), -- 担当（旧 driverOwners → Trip単位に正規化）
  main_owner_id TEXT REFERENCES app_user(id), -- 主担当（旧 mainOwnerId）
  related_return_trip_id TEXT REFERENCES trip(id) DEFERRABLE INITIALLY DEFERRED,  -- 戻り回送の相方（旧 relatedReturnId）。連鎖参照のため遅延検査
  risk_flag     BOOLEAN NOT NULL DEFAULT false,  -- 旧 "アラート"（遅延の恐れ）
  legacy_ids    TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT REFERENCES app_user(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    TEXT REFERENCES app_user(id),
  version       INTEGER NOT NULL DEFAULT 1
);

-- 区間（1ドライバー×1車両が連続して動く単位。中継=区間が複数で別ドライバー）
CREATE TABLE leg (
  id               TEXT PRIMARY KEY,          -- 旧 legId "relay-104-1"
  trip_id          TEXT NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  sequence_no      INTEGER NOT NULL CHECK (sequence_no >= 1),  -- 旧 legNo/sequenceNo
  driver_id        TEXT NOT NULL REFERENCES driver(id),        -- ID参照（旧 driverName 文字列）→ 課題C3。プロト driverRefId に対応
  -- 車両は通常は自社車両を必須。ただし協力会社の傭車（is_hired）は自社マスタ外のため NULL 可
  -- （プロト vehicleRefId に対応。partnerVehicle=true のとき NULL ＝傭車）。
  vehicle_id       TEXT REFERENCES vehicle(id),                -- ID参照（旧 "車両2580"）→ 課題C3。傭車時は NULL
  is_hired         BOOLEAN NOT NULL DEFAULT false,             -- 傭車（協力会社車両）か。プロト leg.partnerVehicle
  hired_company_id TEXT REFERENCES company(id),                -- 傭車先の協力会社（kind='partner'）
  hired_charge_jpy BIGINT CHECK (hired_charge_jpy IS NULL OR hired_charge_jpy >= 0), -- 傭車運賃（partnerRates由来）
  purchase_order_no TEXT,                                      -- 傭車の発注書番号（PO）。プロト leg.purchaseOrderNo
  effective_base_id TEXT REFERENCES base(id),  -- 当日の実働拠点（旧 effectiveBaseId。既定=車両拠点）
  cross_base       BOOLEAN NOT NULL DEFAULT false,  -- クロス配車か（旧 isCrossBaseAssignment / プロト crossBase）
  role             leg_role NOT NULL DEFAULT 'pickup_delivery',
  start_at         TIMESTAMPTZ NOT NULL,      -- 旧 startTime/startDateTime（日付込みで日跨ぎ対応）→ 課題C5
  end_at           TIMESTAMPTZ NOT NULL,
  -- 引き継ぎ（中継・前日積込の接続。旧 handoffType/handoffLocation/nextJobId）
  handoff_type     handoff_type,
  handoff_location TEXT,
  next_leg_id      TEXT REFERENCES leg(id) DEFERRABLE INITIALLY DEFERRED,  -- 区間連鎖は前方参照になるため遅延検査
  -- 作業内訳（分）。旧 loadMin/driveMin/unloadMin
  work_load_min    INTEGER NOT NULL DEFAULT 0 CHECK (work_load_min >= 0),
  work_drive_min   INTEGER NOT NULL DEFAULT 0 CHECK (work_drive_min >= 0),
  work_unload_min  INTEGER NOT NULL DEFAULT 0 CHECK (work_unload_min >= 0),
  work_rest_min    INTEGER NOT NULL DEFAULT 0 CHECK (work_rest_min >= 0),
  active           BOOLEAN NOT NULL DEFAULT true,  -- 取消時に false（EXCLUDE の対象外化）
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE (trip_id, sequence_no),
  CHECK (end_at > start_at),
  -- 傭車は自社車両を持たず協力会社・傭車運賃を伴う／自社便は車両必須・傭車情報なし
  CHECK (is_hired = (vehicle_id IS NULL)),
  CHECK (NOT is_hired OR hired_company_id IS NOT NULL)
);
-- 注: 複数台（増車）での1便ごとの積載按分は assignment.loaded_weight_kg（order×leg）で表現する
--     （プロト leg.loadKg ＝ その便が運ぶ重量）。相積みは複数 assignment の loaded_weight_kg 合算 ≦ 車両最大積載。

-- ★ DBレベルで「同一ドライバー/車両の時間重複」を禁止（旧 validateAssignment の overlap 判定を保証）
ALTER TABLE leg ADD CONSTRAINT leg_driver_no_overlap
  EXCLUDE USING gist (driver_id  WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (active);
ALTER TABLE leg ADD CONSTRAINT leg_vehicle_no_overlap
  EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (active);

-- 立寄地（区間内の発着・経由。旧 from/to を地点列に正規化、多地点配送に対応）
CREATE TABLE stop (
  id                TEXT PRIMARY KEY,
  leg_id            TEXT NOT NULL REFERENCES leg(id) ON DELETE CASCADE,
  sequence_no       INTEGER NOT NULL CHECK (sequence_no >= 1),
  kind              stop_kind NOT NULL,        -- 旧 relayFrom/relayTo/from/to → pickup/dropoff/relay_handoff
  location_id       TEXT NOT NULL REFERENCES location(id),
  planned_arrival   TIMESTAMPTZ,
  planned_departure TIMESTAMPTZ,
  order_id          TEXT REFERENCES transport_order(id),  -- この立寄が紐づく案件
  UNIQUE (leg_id, sequence_no)
);

-- 割当（案件 ↔ 区間 の多対多中間。"どの荷をどの区間で運ぶか"）
-- これにより 1案件→中継2台 / 1区間→相積みN案件 / 戻り回送 を統一表現
CREATE TABLE assignment (
  id              TEXT PRIMARY KEY,            -- 旧 "A00001"
  order_id        TEXT NOT NULL REFERENCES transport_order(id) ON DELETE CASCADE,
  leg_id          TEXT NOT NULL REFERENCES leg(id) ON DELETE CASCADE,
  loaded_weight_kg INTEGER CHECK (loaded_weight_kg >= 0),  -- 相積み時の按分
  note            TEXT,
  legacy_ids      TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (order_id, leg_id)
);
-- 案件→主アサイン の循環FK
ALTER TABLE transport_order ADD CONSTRAINT fk_order_primary_assignment
  FOREIGN KEY (primary_assignment_id) REFERENCES assignment(id) ON DELETE SET NULL;

-- 運行進捗トラッキング（旧 progress/eta/remain/donekm を分離。1区間=1行）
CREATE TABLE leg_tracking (
  leg_id        TEXT PRIMARY KEY REFERENCES leg(id) ON DELETE CASCADE,
  progress_pct  SMALLINT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  driven_km     NUMERIC(7,1) NOT NULL DEFAULT 0,
  remaining_km  NUMERIC(7,1),
  eta           TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
--  5. 法令層（改善基準告示チェック。旧 vehicles[].law を区間/ドライバー単位に）
-- ============================================================================
CREATE TABLE compliance_check (
  id           TEXT PRIMARY KEY,
  leg_id       TEXT NOT NULL REFERENCES leg(id) ON DELETE CASCADE,
  driver_id    TEXT NOT NULL REFERENCES driver(id),
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  overall      compliance_overall NOT NULL,   -- 旧 law.status ok/warn(+violation)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE compliance_item (
  id          TEXT PRIMARY KEY,
  check_id    TEXT NOT NULL REFERENCES compliance_check(id) ON DELETE CASCADE,
  rule        compliance_rule NOT NULL,        -- 6項目
  ok          BOOLEAN NOT NULL,
  actual      NUMERIC(7,2),                    -- 実績値（数値で保持）
  limit_value NUMERIC(7,2),                    -- 上限値
  unit        TEXT,                            -- 'hour' | 'minute'
  message     TEXT                             -- 旧 val "連続運転3.6h — あと0.4hで上限"
);

-- ドライバー稼働実績（compliance の計算ソース）
CREATE TABLE driver_work_log (
  id                  TEXT PRIMARY KEY,
  driver_id           TEXT NOT NULL REFERENCES driver(id) ON DELETE CASCADE,
  work_date           DATE NOT NULL,
  drive_minutes       INTEGER NOT NULL DEFAULT 0,
  duty_minutes        INTEGER NOT NULL DEFAULT 0,
  rest_minutes        INTEGER NOT NULL DEFAULT 0,
  weekly_drive_minutes INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, work_date)
);
CREATE TABLE driver_work_log_leg (
  log_id  TEXT NOT NULL REFERENCES driver_work_log(id) ON DELETE CASCADE,
  leg_id  TEXT NOT NULL REFERENCES leg(id) ON DELETE CASCADE,
  PRIMARY KEY (log_id, leg_id)
);

-- ============================================================================
--  6. 運賃・請求層
-- ============================================================================
CREATE TABLE fare (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES transport_order(id) ON DELETE CASCADE,
  base_jpy    BIGINT NOT NULL DEFAULT 0 CHECK (base_jpy >= 0),
  distance_km NUMERIC(7,1),
  total_jpy   BIGINT NOT NULL DEFAULT 0 CHECK (total_jpy >= 0),
  source      fare_source NOT NULL DEFAULT 'manual',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  version     INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE transport_order ADD CONSTRAINT fk_order_fare
  FOREIGN KEY (fare_id) REFERENCES fare(id) ON DELETE SET NULL;

CREATE TABLE fare_surcharge (
  id          TEXT PRIMARY KEY,
  fare_id     TEXT NOT NULL REFERENCES fare(id) ON DELETE CASCADE,
  kind        surcharge_kind NOT NULL,         -- 燃料/高速/待機 等
  amount_jpy  BIGINT NOT NULL CHECK (amount_jpy >= 0),
  note        TEXT
);

-- 請求（旧 processedCases の invoiceNo/sales/fuel/profit/margin/billingConfirmed... を実体化）
CREATE TABLE invoice (
  id           TEXT PRIMARY KEY,
  invoice_no   TEXT NOT NULL UNIQUE,           -- 旧 "INV-202405-00123"
  client_id    TEXT NOT NULL REFERENCES company(id),
  issue_date   DATE NOT NULL,                  -- 旧 invoiceDate
  due_date     DATE NOT NULL,                  -- 旧 due
  total_jpy    BIGINT NOT NULL DEFAULT 0 CHECK (total_jpy >= 0),  -- 旧 sales 合計
  cost_jpy     BIGINT NOT NULL DEFAULT 0,      -- 燃料+その他（旧 fuel+other）
  -- 粗利・粗利率は派生（旧 profit/margin を生成列で保証）
  profit_jpy   BIGINT GENERATED ALWAYS AS (total_jpy - cost_jpy) STORED,
  status       invoice_status NOT NULL DEFAULT 'draft',
  confirmed_at TIMESTAMPTZ,                    -- 旧 billingConfirmedAt
  confirmed_by TEXT REFERENCES app_user(id),   -- 旧 billingConfirmedBy
  paid         BOOLEAN NOT NULL DEFAULT false, -- 旧 paid
  legacy_ids   TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  version      INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE invoice_trip (
  invoice_id TEXT NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  trip_id    TEXT NOT NULL REFERENCES trip(id) ON DELETE CASCADE,
  PRIMARY KEY (invoice_id, trip_id)
);
CREATE TABLE invoice_line (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
  order_id    TEXT NOT NULL REFERENCES transport_order(id),
  sales_jpy   BIGINT NOT NULL DEFAULT 0,
  fuel_jpy    BIGINT NOT NULL DEFAULT 0,
  other_jpy   BIGINT NOT NULL DEFAULT 0
);

-- ============================================================================
--  7. 協調・監査層（横断）
-- ============================================================================
CREATE TABLE ownership (
  subject_type ownership_subject NOT NULL,     -- 旧 driverOwners
  subject_id   TEXT NOT NULL,
  owner_id     TEXT NOT NULL REFERENCES app_user(id),
  is_primary   BOOLEAN NOT NULL DEFAULT true,  -- 旧 mainOwnerId 相当
  PRIMARY KEY (subject_type, subject_id, owner_id)
);
CREATE TABLE edit_lock (
  subject_type lock_subject NOT NULL,          -- 旧 driverLocks
  subject_id   TEXT NOT NULL,
  user_id      TEXT NOT NULL REFERENCES app_user(id),
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 旧 startedAt
  expires_at   TIMESTAMPTZ NOT NULL,           -- 自動失効
  PRIMARY KEY (subject_type, subject_id)
);
CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id   TEXT REFERENCES app_user(id),
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  action     audit_action NOT NULL,
  diff       JSONB NOT NULL DEFAULT '{}'
);
CREATE TABLE notification (
  id         TEXT PRIMARY KEY,
  to_user_id TEXT NOT NULL REFERENCES app_user(id),
  kind       notification_kind NOT NULL,
  ref_type   TEXT,
  ref_id     TEXT,
  message    TEXT NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
--  8. インデックス
-- ============================================================================
CREATE INDEX idx_company_kind          ON company(kind);
CREATE INDEX idx_vehicle_home_base     ON vehicle(home_base_id);
CREATE INDEX idx_driver_home_base      ON driver(home_base_id);
CREATE INDEX idx_driver_partner        ON driver(partner_company_id);
CREATE INDEX idx_reception_status      ON reception(status, received_at DESC);
CREATE INDEX idx_order_client          ON transport_order(client_id);
CREATE INDEX idx_order_status          ON transport_order(status);
CREATE INDEX idx_order_completed_at    ON transport_order(completed_at);
CREATE INDEX idx_trip_date_tab         ON trip(service_date, tab);
CREATE INDEX idx_trip_owner            ON trip(owner_id);
CREATE INDEX idx_leg_trip              ON leg(trip_id);
CREATE INDEX idx_leg_driver_time       ON leg(driver_id, start_at);
CREATE INDEX idx_leg_vehicle_time      ON leg(vehicle_id, start_at);
CREATE INDEX idx_stop_leg              ON stop(leg_id);
CREATE INDEX idx_stop_order            ON stop(order_id);
CREATE INDEX idx_assignment_order      ON assignment(order_id);
CREATE INDEX idx_assignment_leg        ON assignment(leg_id);
CREATE INDEX idx_compliance_leg        ON compliance_check(leg_id);
CREATE INDEX idx_worklog_driver_date   ON driver_work_log(driver_id, work_date);
CREATE INDEX idx_invoice_client        ON invoice(client_id, issue_date);
CREATE INDEX idx_audit_entity          ON audit_log(entity, entity_id);
CREATE INDEX idx_notification_user     ON notification(to_user_id, read_at);

-- ============================================================================
--  9. updated_at トリガ（主要テーブル）
-- ============================================================================
CREATE TRIGGER trg_company_upd  BEFORE UPDATE ON company         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_vehicle_upd  BEFORE UPDATE ON vehicle         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_driver_upd   BEFORE UPDATE ON driver          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_order_upd    BEFORE UPDATE ON transport_order FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_trip_upd     BEFORE UPDATE ON trip            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_leg_upd      BEFORE UPDATE ON leg             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_asgn_upd     BEFORE UPDATE ON assignment      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoice_upd  BEFORE UPDATE ON invoice         FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
--  10. 派生ビュー：運行層(SSoT) → 旧UIの3画面を再構成（旧データの三重管理を解消 → 課題C6）
-- ============================================================================

-- (A) 配車計画表ガントの「ブロック」（旧 scheduleData[].blocks[]。1区間=1ブロック）
CREATE VIEW v_schedule_block AS
SELECT
  l.id            AS leg_id,
  t.id            AS trip_id,
  t.tab,
  t.service_date,
  t.status        AS trip_status,
  t.risk_flag,
  l.driver_id,
  d.name          AS driver_name,
  l.vehicle_id,
  v.plate_label   AS vehicle_label,
  l.role,
  l.start_at,
  l.end_at,
  -- from = 最初の立寄地、to = 最後の立寄地（旧 from/to）
  (SELECT loc.city FROM stop s JOIN location loc ON loc.id = s.location_id
     WHERE s.leg_id = l.id ORDER BY s.sequence_no ASC  LIMIT 1) AS from_city,
  (SELECT loc.city FROM stop s JOIN location loc ON loc.id = s.location_id
     WHERE s.leg_id = l.id ORDER BY s.sequence_no DESC LIMIT 1) AS to_city,
  -- client（相積みは複数社を連結）
  (SELECT string_agg(DISTINCT co.name, ' / ')
     FROM assignment a JOIN transport_order o ON o.id = a.order_id
     JOIN company co ON co.id = o.client_id WHERE a.leg_id = l.id) AS clients,
  l.handoff_type,
  l.handoff_location
FROM leg l
JOIN trip t    ON t.id = l.trip_id
JOIN driver d  ON d.id = l.driver_id
JOIN vehicle v ON v.id = l.vehicle_id
WHERE l.active;

-- (B) DnDボード：日付×ドライバー×車両 ごとの区間配列（旧 dndDrivers + preset）
CREATE VIEW v_dnd_board AS
SELECT
  t.service_date,
  t.tab,
  l.driver_id,
  d.name        AS driver_name,
  l.vehicle_id,
  v.plate_label AS vehicle_label,
  json_agg(
    json_build_object(
      'legId', l.id, 'role', l.role,
      'start', l.start_at, 'end', l.end_at,
      'crossBase', l.cross_base, 'handoff', l.handoff_type
    ) ORDER BY l.start_at
  ) AS legs
FROM leg l
JOIN trip t    ON t.id = l.trip_id
JOIN driver d  ON d.id = l.driver_id
JOIN vehicle v ON v.id = l.vehicle_id
WHERE l.active
GROUP BY t.service_date, t.tab, l.driver_id, d.name, l.vehicle_id, v.plate_label;

-- (C) 案件タイムライン：案件ごとの区間列（旧 case-schedule。中継・日跨ぎ・引き継ぎを表示）
CREATE VIEW v_case_timeline AS
SELECT
  o.id          AS order_id,
  o.order_no,
  a.leg_id,
  l.sequence_no,
  l.role,
  l.start_at,
  l.end_at,
  (l.start_at::date <> l.end_at::date) AS is_multiday,  -- 旧 isMultiDay（日跨ぎ）
  l.handoff_type,
  l.handoff_location,
  d.name        AS driver_name,
  v.plate_label AS vehicle_label
FROM transport_order o
JOIN assignment a ON a.order_id = o.id
JOIN leg l        ON l.id = a.leg_id AND l.active
JOIN trip t       ON t.id = l.trip_id
JOIN driver d     ON d.id = l.driver_id
JOIN vehicle v    ON v.id = l.vehicle_id;

COMMIT;

-- ============================================================================
--  COMMENT（主要テーブルの旧構造対応。\d+ や情報スキーマで参照可能）
-- ============================================================================
COMMENT ON TABLE company         IS '会社マスタ。旧 clientMasterData + partnerMasterData を kind で統合';
COMMENT ON TABLE transport_order IS '案件。旧 allCasesMasterData/unprocessed/processing/processedCases を統合（課題C7）';
COMMENT ON TABLE trip            IS '運行（SSoT）。旧 scheduleData 行 + jobId。Gantt/DnD/案件TLはこの派生';
COMMENT ON TABLE leg             IS '区間（SSoT）。旧 case.legs[] + schedule blocks。同一ドライバー/車両の時間重複はEXCLUDEで禁止';
COMMENT ON TABLE assignment      IS '案件×区間の多対多中間。中継/相積み/戻り回送を統一表現';
COMMENT ON VIEW  v_schedule_block IS '運行層→配車計画ガント の派生ビュー（旧 scheduleData.blocks）';
COMMENT ON VIEW  v_dnd_board      IS '運行層→DnDボード の派生ビュー（旧 dndDrivers）';
COMMENT ON VIEW  v_case_timeline  IS '運行層→案件タイムライン の派生ビュー（旧 case-schedule）';

-- ============================================================================
--  §移植メモ（他RDBへ移す場合）
--    - ENUM      → MySQL は ENUM 可 / その他は CHECK 制約 + 参照テーブルで代替
--    - 配列(TEXT[]/enum[]) → 別テーブル（junction）へ正規化、または JSON
--    - EXCLUDE   → PostgreSQL固有。代替はアプリ層 or トリガで重複検査（旧 validateAssignment 相当）
--    - JSONB     → MySQL は JSON / その他は TEXT + アプリ検証
--    - 生成列     → サポート外なら VIEW or アプリ算出（invoice.profit_jpy）
-- ============================================================================
