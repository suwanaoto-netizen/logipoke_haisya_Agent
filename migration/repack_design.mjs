#!/usr/bin/env node
/* 新デザイン(index.html standalone バンドル)の React App コンポーネントに、
 * AI電話受付のライブ取込み(storage リスナ)を注入して再パックする。
 *   node migration/repack_design.mjs
 * バンドル同梱の Babel で「編集後ソースが実際に transpile できる」ことを検証してから書き戻す。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const APP_ID = 'a63af87b-ee27-4ee5-b127-ba510703cb82'; // 編集対象（エントリ App, integrity 無し）
const BABEL_ID = 'bad55c6d-3423-41aa-a894-17da932fca25'; // 同梱 @babel/standalone

const html = readFileSync('index.html', 'utf8');
const OPEN = '<script type="__bundler/manifest">';
const oi = html.indexOf(OPEN);
const ci = html.indexOf('</script>', oi);
if (oi < 0 || ci < 0) { console.error('manifest セクションが見つかりません'); process.exit(1); }
const manifestText = html.slice(oi + OPEN.length, ci);
const manifest = JSON.parse(manifestText);

function decode(id) {
  const e = manifest[id]; let buf = Buffer.from(e.data, 'base64');
  if (e.compressed) buf = gunzipSync(buf);
  return buf.toString('utf8');
}

// ── App ソースを編集：lucide エフェクトの直後に AI受付ライブ取込みエフェクトを挿入 ──
let appSrc = decode(APP_ID);
const ANCHOR = '  // re-render lucide icons after each paint\n  useAppEffect(() => { if (window.lucide) window.lucide.createIcons(); });';
if (!appSrc.includes(ANCHOR)) { console.error('挿入アンカーが見つかりません（App ソース構造が変わった可能性）'); process.exit(1); }
if (appSrc.includes('LogipokeDesign')) { console.log('既に注入済み。スキップ。'); process.exit(0); }

const INJECT = ANCHOR + `

  // AI電話受付ブリッジ: 他タブ(ai-phone-reception.html)の受付を storage 経由でライブ反映。
  // 初期表示分は logipoke-design-bridge.js が window.LP_DATA に前置済み。ここは稼働中の追加分。
  useAppEffect(() => {
    function syncAi() {
      if (!window.LogipokeDesign) return;
      const ai = window.LogipokeDesign.getAiCases();
      if (!ai.length) return;
      setCases((prev) => {
        const ids = new Set(prev.map((c) => c.id));
        const add = ai.filter((c) => !ids.has(c.id));
        return add.length ? [...add, ...prev] : prev;
      });
    }
    const key = window.LogipokeDB && window.LogipokeDB.RECEPTION_KEY;
    const onStorage = (e) => { if (e.key === key) syncAi(); };
    const onVis = () => { if (document.visibilityState === "visible") syncAi(); };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("storage", onStorage); document.removeEventListener("visibilitychange", onVis); };
  }, []);`;

const newAppSrc = appSrc.replace(ANCHOR, INJECT);

// ── 検証①: バンドル同梱 Babel で transpile できるか（JSX 構文チェック）──
const babelSrc = decode(BABEL_ID);
const tmp = '/tmp/babel-standalone.cjs';
writeFileSync(tmp, babelSrc);
globalThis.self = globalThis; // Babel standalone の self 参照対策
const Babel = require(tmp);
try {
  Babel.transform(newAppSrc, { presets: ['react'] });
  console.log('✓ 編集後 App ソースは Babel(react preset) で transpile OK');
} catch (e) {
  console.error('✗ Babel transpile 失敗（編集を中止）:\n  ' + String(e.message || e).split('\n')[0]);
  process.exit(1);
}

// ── 再パック: gzip + base64 で manifest を更新し index.html を書き戻す ──
manifest[APP_ID].data = gzipSync(Buffer.from(newAppSrc, 'utf8')).toString('base64');
manifest[APP_ID].compressed = true;
const newManifestText = JSON.stringify(manifest);
if (newManifestText.includes('</script>')) { console.error('manifest に </script> が混入（中止）'); process.exit(1); }
const newHtml = html.slice(0, oi + OPEN.length) + newManifestText + html.slice(ci);
writeFileSync('index.html', newHtml);
console.log('✓ index.html を再パック（App に AI受付ライブ取込みを注入）');
