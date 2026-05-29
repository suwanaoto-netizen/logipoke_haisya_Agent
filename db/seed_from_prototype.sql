-- ============================================================
-- 自動生成: migration/transform_prototype.mjs（prototype → 理想モデル）
-- 適用前提: db/schema.sql 済み。 psql -v ON_ERROR_STOP=1 -f db/seed_from_prototype.sql
-- ============================================================
BEGIN;
-- ① マスタ層: 社内ユーザー
INSERT INTO app_user (id, name, role, color) VALUES ('usr_me', '配車 太郎', 'dispatcher', '#1a7a5e');
INSERT INTO app_user (id, name, role, color) VALUES ('usr_u2', '田中 花子', 'dispatcher', '#dc2626');
-- ① マスタ層: 拠点 / 拠点間距離
INSERT INTO base (id, name, region, aliases) VALUES ('base_b001', '川口拠点', '関東', '{"川口市","川口","埼玉県川口市"}');
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0001', '埼玉県川口市', '埼玉県', '川口市', 'base_b001');
UPDATE base SET location_id = 'loc_0001' WHERE id = 'base_b001';
INSERT INTO base (id, name, region, aliases) VALUES ('base_b005', '品川拠点', '関東', '{"品川区","品川","東京都品川区"}');
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0002', '東京都品川区', '東京都', '品川区', 'base_b005');
UPDATE base SET location_id = 'loc_0002' WHERE id = 'base_b005';
INSERT INTO base (id, name, region, aliases) VALUES ('base_b007', '横浜拠点', '関東', '{"横浜市","横浜","神奈川県横浜市"}');
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0003', '神奈川県横浜市', '神奈川県', '横浜市', 'base_b007');
UPDATE base SET location_id = 'loc_0003' WHERE id = 'base_b007';
INSERT INTO base_distance (from_base_id, to_base_id, distance_km) VALUES ('base_b001', 'base_b005', 25);
INSERT INTO base_distance (from_base_id, to_base_id, distance_km) VALUES ('base_b005', 'base_b007', 18);
-- ① マスタ層: 車格
INSERT INTO vehicle_type (id, name, body_type, ton_class, max_load_kg, temp_zones) VALUES ('vtype_4t_flatbed', '4t平車', 'flatbed', 4, 4000, '{"ambient"}');
INSERT INTO vehicle_type (id, name, body_type, ton_class, max_load_kg, temp_zones) VALUES ('vtype_4t_wing', '4tウィング', 'wing', 4, 4000, '{"ambient"}');
INSERT INTO vehicle_type (id, name, body_type, ton_class, max_load_kg, temp_zones) VALUES ('vtype_2t', '2tトラック', 'box', 2, 2000, '{"ambient","chilled"}');
INSERT INTO vehicle_type (id, name, body_type, ton_class, max_load_kg, temp_zones) VALUES ('vtype_reefer', '冷蔵車', 'reefer', 4, 4000, '{"chilled","frozen"}');
-- ① マスタ層: 会社（荷主+協力会社を統合）
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0004', '埼玉県川口市', '埼玉県', '川口市', NULL);
INSERT INTO company (id, kind, name, location_id, contact_name, contact_tel, contact_email, client_type, legacy_ids) VALUES ('co_cl001', 'client', '株式会社○○商事', 'loc_0004', '山田 花子', '048-111-2222', 'y.hanako@marumarushouji.co.jp', 'regular', '{"CL-001"}');
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0005', '大阪府大阪市', '大阪府', '大阪市', NULL);
INSERT INTO company (id, kind, name, location_id, contact_name, contact_tel, contact_email, client_type, legacy_ids) VALUES ('co_cl005', 'client', '関西化学工業株式会社', 'loc_0005', '伊藤 四郎', '06-9999-0000', 'ito@kansaichem.co.jp', 'charter', '{"CL-005"}');
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0006', '埼玉県熊谷市', '埼玉県', '熊谷市', NULL);
INSERT INTO company (id, kind, name, location_id, contact_name, contact_tel, contact_email, legacy_ids) VALUES ('co_pt001', 'partner', '北関東物流株式会社', 'loc_0006', '安藤 清志', '048-222-3333', 'ando@kitatrans.co.jp', '{"PT-001"}');
-- ② 受付層: AI電話受付（旧 localStorage intake を正規化）
INSERT INTO reception (id, channel, received_at, status, ai_confidence, matched_client_id, extraction, legacy_ids) VALUES ('rcpt_ai20260529134501', 'ai_phone', '2026-05-29T13:45:01+09:00', 'confirmed', 'high', NULL, '{"clientName":"株式会社サンライズ物産","origin":"千葉県市原市","destination":"神奈川県横浜市（横浜港）","goods":"建材 / 2,500kg / 常温（4t平ボディ）","deadline":"05/19 13:00 集荷指定","conditions":"バース予約済み / 担当：佐藤様"}'::jsonb, '{"AI20260529134501"}');
INSERT INTO company (id, kind, name, client_type, legacy_ids) VALUES ('co_sunrise', 'client', '株式会社サンライズ物産', 'spot', '{}');
-- ③ 案件層: transport_order（旧 4テーブルを統合）
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0007', '埼玉県川口市', '埼玉県', '川口市', NULL);
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0008', '神奈川県横浜市', '神奈川県', '横浜市', NULL);
INSERT INTO transport_order (id, order_no, client_id, origin_location_id, destination_location_id, cargo_description, cargo_packaging, cargo_weight_kg, cargo_temp_zone, delivery_latest, delivery_label, delivery_strict, pattern, priority, status, channel, completed_at, legacy_ids) VALUES ('ord_20240524001', '20240524001', 'co_cl001', 'loc_0007', 'loc_0008', 'パレット', 'pallet', 800, 'ambient', '2024-05-25T12:00:00+09:00', '05/25 AM指定', TRUE, 'regular', 'normal', 'unassigned', 'phone', NULL, '{"20240524001"}');
INSERT INTO order_event (id, order_id, to_status, reason) VALUES ('oev_20240524001', 'ord_20240524001', 'unassigned', 'migrated from prototype');
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0009', '千葉県市原市', '千葉県', '市原市', NULL);
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0010', '神奈川県横浜市（横浜港）', '神奈川県', '横浜市', NULL);
INSERT INTO transport_order (id, order_no, client_id, origin_location_id, destination_location_id, cargo_description, cargo_packaging, cargo_weight_kg, cargo_temp_zone, delivery_latest, delivery_label, delivery_strict, pattern, priority, status, channel, completed_at, legacy_ids) VALUES ('ord_aiai20260529134501', 'AI-AI20260529134501', 'co_sunrise', 'loc_0009', 'loc_0010', '建材', 'other', 2500, 'ambient', '2024-05-19T13:00:00+09:00', '05/19 13:00 集荷指定', TRUE, 'spot', 'normal', 'unassigned', 'phone', NULL, '{"AI-AI20260529134501"}');
INSERT INTO order_event (id, order_id, to_status, reason) VALUES ('oev_aiai20260529134501', 'ord_aiai20260529134501', 'unassigned', 'migrated from prototype');
UPDATE transport_order SET reception_id = 'rcpt_ai20260529134501' WHERE id = 'ord_aiai20260529134501';
UPDATE reception SET order_id = 'ord_aiai20260529134501' WHERE id = 'rcpt_ai20260529134501';
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0011', '東京都品川区', '東京都', '品川区', NULL);
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0012', '大阪府大阪市', '大阪府', '大阪市', NULL);
INSERT INTO transport_order (id, order_no, client_id, origin_location_id, destination_location_id, cargo_description, cargo_packaging, cargo_weight_kg, cargo_temp_zone, delivery_latest, delivery_label, delivery_strict, pattern, priority, status, channel, completed_at, legacy_ids) VALUES ('ord_20240524104', '20240524104', 'co_cl005', 'loc_0011', 'loc_0012', '化学品', 'other', 900, 'ambient', '2024-05-26T12:00:00+09:00', '05/26 AM', FALSE, 'charter', 'urgent', 'assigning', 'manual', NULL, '{"20240524104"}');
INSERT INTO order_event (id, order_id, to_status, reason) VALUES ('oev_20240524104', 'ord_20240524104', 'assigning', 'migrated from prototype');
-- ④ 運行層: 中継運行 20240524104（旧 case.legs[] を Trip/Leg/Stop/Assignment へ）
INSERT INTO trip (id, service_date, status, shape, multi_reasons, legacy_ids) VALUES ('trip_20240524104', '2024-05-27', 'planned', 'relay', '{"長距離での運転手の改善基準対策","拘束時間の分散"}', '{"J-20240524104-RELAY"}');
INSERT INTO driver (id, name, is_partner, partner_company_id, home_base_id, legacy_ids) VALUES ('drv_001', '松本 十郎', FALSE, NULL, NULL, '{}');
INSERT INTO vehicle (id, plate_label, vehicle_type_id, home_base_id, legacy_ids) VALUES ('veh_2580', '車両2580', 'vtype_4t_flatbed', 'base_b005', '{"V2580"}');
INSERT INTO leg (id, trip_id, sequence_no, driver_id, vehicle_id, role, start_at, end_at, handoff_type, handoff_location, next_leg_id, work_load_min, work_drive_min, work_unload_min) VALUES ('leg_20240524104_1', 'trip_20240524104', 1, 'drv_001', 'veh_2580', 'relay', '2024-05-27T06:00:00+09:00', '2024-05-27T10:30:00+09:00', 'driver_swap', '愛知県名古屋市', 'leg_20240524104_2', 0, 0, 0);
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0013', '東京都品川区', '東京都', '品川区', NULL);
INSERT INTO stop (id, leg_id, sequence_no, kind, location_id, order_id) VALUES ('leg_20240524104_1_s1', 'leg_20240524104_1', 1, 'pickup', 'loc_0013', 'ord_20240524104');
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0014', '愛知県名古屋市', '愛知県', '名古屋市', NULL);
INSERT INTO stop (id, leg_id, sequence_no, kind, location_id, order_id) VALUES ('leg_20240524104_1_s2', 'leg_20240524104_1', 2, 'relay_handoff', 'loc_0014', 'ord_20240524104');
INSERT INTO assignment (id, order_id, leg_id) VALUES ('asgn_20240524104_1', 'ord_20240524104', 'leg_20240524104_1');
INSERT INTO compliance_check (id, leg_id, driver_id, overall) VALUES ('comp_20240524104_1', 'leg_20240524104_1', 'drv_001', 'ok');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_1_0', 'comp_20240524104_1', 'daily_drive', TRUE, '全員 9h以内');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_1_1', 'comp_20240524104_1', 'duty_hours', TRUE, '全員 13h以内');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_1_2', 'comp_20240524104_1', 'weekly_cap', TRUE, '全員 週65h以内');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_1_3', 'comp_20240524104_1', 'interval_rest', TRUE, 'インターバル8h確保');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_1_4', 'comp_20240524104_1', 'continuous_drive', TRUE, '上限まで余裕あり');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_1_5', 'comp_20240524104_1', 'break_rule', TRUE, '30分休憩ルール適合');
INSERT INTO driver (id, name, is_partner, partner_company_id, home_base_id, legacy_ids) VALUES ('drv_002', '山田 一郎', FALSE, NULL, NULL, '{}');
INSERT INTO vehicle (id, plate_label, vehicle_type_id, home_base_id, legacy_ids) VALUES ('veh_1245', '車両1245', 'vtype_4t_flatbed', 'base_b005', '{"V1245"}');
INSERT INTO leg (id, trip_id, sequence_no, driver_id, vehicle_id, role, start_at, end_at, handoff_type, handoff_location, next_leg_id, work_load_min, work_drive_min, work_unload_min) VALUES ('leg_20240524104_2', 'trip_20240524104', 2, 'drv_002', 'veh_1245', 'relay', '2024-05-27T11:00:00+09:00', '2024-05-27T14:30:00+09:00', NULL, NULL, NULL, 0, 0, 0);
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0015', '愛知県名古屋市', '愛知県', '名古屋市', NULL);
INSERT INTO stop (id, leg_id, sequence_no, kind, location_id, order_id) VALUES ('leg_20240524104_2_s1', 'leg_20240524104_2', 1, 'relay_handoff', 'loc_0015', 'ord_20240524104');
INSERT INTO location (id, raw, prefecture, city, base_id) VALUES ('loc_0016', '大阪府大阪市', '大阪府', '大阪市', NULL);
INSERT INTO stop (id, leg_id, sequence_no, kind, location_id, order_id) VALUES ('leg_20240524104_2_s2', 'leg_20240524104_2', 2, 'dropoff', 'loc_0016', 'ord_20240524104');
INSERT INTO assignment (id, order_id, leg_id) VALUES ('asgn_20240524104_2', 'ord_20240524104', 'leg_20240524104_2');
INSERT INTO compliance_check (id, leg_id, driver_id, overall) VALUES ('comp_20240524104_2', 'leg_20240524104_2', 'drv_002', 'ok');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_2_0', 'comp_20240524104_2', 'daily_drive', TRUE, '全員 9h以内');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_2_1', 'comp_20240524104_2', 'duty_hours', TRUE, '全員 13h以内');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_2_2', 'comp_20240524104_2', 'weekly_cap', TRUE, '全員 週65h以内');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_2_3', 'comp_20240524104_2', 'interval_rest', TRUE, 'インターバル8h確保');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_2_4', 'comp_20240524104_2', 'continuous_drive', TRUE, '上限まで余裕あり');
INSERT INTO compliance_item (id, check_id, rule, ok, message) VALUES ('comp_20240524104_2_5', 'comp_20240524104_2', 'break_rule', TRUE, '30分休憩ルール適合');
-- ⑥ 請求層: invoice（旧 processedCases の請求情報）
INSERT INTO invoice (id, invoice_no, client_id, issue_date, due_date, total_jpy, cost_jpy, status, paid, confirmed_at, legacy_ids) VALUES ('inv_inv20240500123', 'INV-202405-00123', 'co_cl001', '2024-05-26', '2024-06-30', 45000, 18000, 'issued', FALSE, '2024-05-27T10:30:00+09:00', '{"20240524001"}');
COMMIT;
