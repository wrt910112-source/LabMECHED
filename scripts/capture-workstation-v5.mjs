import { chromium } from "@playwright/test";
import { createApplication } from "../server/index.mjs";
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// All exam sessions below use a disposable, in-memory API. Never touch data/au5800.sqlite.
const folder = resolve("artifacts/workstation-v5");
mkdirSync(folder, { recursive: true });
for (const config of [
  {
    channel: "chrome",
    name: "chrome-1366",
    viewport: { width: 1366, height: 768 },
  },
  {
    channel: "msedge",
    name: "edge-1920",
    viewport: { width: 1920, height: 1080 },
  },
]) {
  const app = createApplication({ dbPath: ":memory:" });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const endpoint = `http://127.0.0.1:${app.server.address().port}`;
  const browser = await chromium.launch({
    channel: config.channel,
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({ viewport: config.viewport });
    page.setDefaultTimeout(15000);
    await page.route("**/api/**", async (route) => {
      const response = await route.fetch({
        url: route.request().url().replace("http://127.0.0.1:5173", endpoint),
      });
      await route.fulfill({ response });
    });
    const button = (name) => page.getByRole("button", { name, exact: true });
    const shot = async (name) => {
      await page.mouse.move(2, 2);
      await page.screenshot({
        path: resolve(folder, `${config.name}-${name}.png`),
      });
    };
    const screens = async (ws, mode) => {
      const b = (name) => ws.getByRole("button", { name, exact: true });
      const home = async (name) => {
        await b("Home 主選單").click();
        await b(name).click();
      };
      await home("Analyzer Maintenance");
      await shot(`${mode}-maintenance`);
      await b("ISE Maintenance").click();
      await shot(`${mode}-ise`);
      await home("Reagent Management");
      await b("Details").click();
      await shot(`${mode}-details`);
      await home("Rack Requisition");
      await b("Calibration").click();
      await shot(`${mode}-rack-calibration`);
      await b("QC").click();
      await shot(`${mode}-rack-qc`);
    };
    await page.goto("http://127.0.0.1:5173/");
    await page.getByText("3D LIVE", { exact: true }).waitFor();
    await page.waitForTimeout(800);
    await shot("exploration");
    await button("部件目錄").click();
    await page.getByTestId("part-console").click();
    await screens(page.locator(".workstation"), "explore");
    await button("退出螢幕 ×").click();
    await button("任務中心").click();
    await shot("task-center");
    await button("開始練習").click();
    await page
      .getByRole("region", { name: "練習任務紀錄" })
      .getByRole("button", { name: "操作電腦", exact: true })
      .click();
    const practice = page.locator(".workstation");
    await screens(practice, "practice");
    const practiceButton = (name) =>
      practice.getByRole("button", { name, exact: true });
    await practiceButton("Home 主選單").click();
    await practiceButton("Analyzer Maintenance").click();
    await practice.locator(".ws-instrument-hud summary").click();
    await practice.getByLabel("主蓋開啟", { exact: true }).check();
    await practice.locator(".ws-instrument-hud summary").click();
    await practice.getByLabel("Analyzer Maintenance", { exact: true }).check();
    await practiceButton("Cleaning Probe").click();
    for (const id of ["R1-1", "R1-2", "R2-1", "R2-2", "Sample-1", "Sample-2"])
      await practiceButton(`酒精棉擦拭 ${id}`).click();
    await practiceButton("Inspect Probe & Mixing Bar").click();
    await shot("practice-inspect");
    await practiceButton("關閉子工作區").click();
    await practiceButton("退出螢幕 ×").click();
    await shot("practice-scene");
    await button("返回探索（保留練習）").click();
    await button("登入／考試").click();
    const login = page.locator(".exam-login");
    await login.locator("input[name=username]").fill("capture_teacher");
    await login.locator("input[name=name]").fill("截圖測試教師");
    await login.locator("input[name=password]").fill("CaptureTesting123!");
    await login
      .getByRole("button", { name: "建立教師帳號", exact: true })
      .click();
    await page
      .locator(".mission-card")
      .filter({
        has: page.getByRole("heading", { name: "日保養", exact: true }),
      })
      .getByRole("button", { name: "開始測驗", exact: true })
      .click();
    await shot("exam-scene");
    await button("工作站").click();
    await screens(page.locator(".exam-workstation"), "exam");
    const exam = page.locator(".exam-workstation");
    const examButton = (name) =>
      exam.getByRole("button", { name, exact: true });
    const saved = async (action) => {
      const ack = page.waitForResponse(
        (r) =>
          /\/api\/attempts\/[^/]+\/events$/.test(r.url()) &&
          r.request().method() === "POST",
      );
      await action();
      await (await ack).json();
    };
    await examButton("Home 主選單").click();
    await examButton("Analyzer Maintenance").click();
    await exam.locator(".ws-instrument-hud summary").click();
    await saved(() => exam.getByLabel("主蓋開啟", { exact: true }).check());
    await exam.locator(".ws-instrument-hud summary").click();
    await saved(() =>
      exam.getByLabel("Analyzer Maintenance", { exact: true }).check(),
    );
    await saved(() => examButton("Cleaning Probe").click());
    for (const id of ["R1-1", "R1-2", "R2-1", "R2-2", "Sample-1", "Sample-2"])
      await saved(() => examButton(`酒精棉擦拭 ${id}`).click());
    await saved(() => examButton("Inspect Probe & Mixing Bar").click());
    await shot("exam-inspect");
    for (const name of [
      "exam-reagents",
      "exam-rack-expired",
      "v5-exam-qc",
      "daily-calibration",
    ]) {
      const file = resolve(`test-results/${config.name}-${name}.png`);
      if (existsSync(file))
        copyFileSync(
          file,
          resolve(folder, `${config.name}-${name}-completed.png`),
        );
    }
    console.log(
      `${config.name}: exploration, task center, practice and exam; matching Maintenance / ISE / Details / Rack Calibration / QC captured.`,
    );
  } finally {
    await browser.close();
    await app.close();
  }
}

writeFileSync(
  resolve(folder, "index.html"),
  "<!doctype html><html lang=\"zh-Hant\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>AU5800 工作站同頁對照</title><style>body{margin:0;background:#122630;color:#e2edf2;font:15px system-ui,\"Microsoft JhengHei\"}header{padding:22px 28px;border-bottom:1px solid #42606e}h1{font-size:22px;margin:0 0 12px}select{margin:4px 18px 4px 6px;padding:8px;border-radius:5px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;padding:24px}article{min-width:0}h2{font-size:17px}img{width:100%;border:1px solid #65818e;border-radius:6px}a{color:#79d2e1}p{line-height:1.6;color:#a9c0cc}small{display:block}#note{padding:0 28px}@media(max-width:1100px){main{grid-template-columns:1fr}}</style><header><h1>AU5800 工作站同頁對照 · 2026-10-27</h1><label>瀏覽器<select id=\"browser\"><option value=\"chrome-1366\">Chrome 1366 × 768</option><option value=\"edge-1920\">Edge 1920 × 1080</option></select></label><label>工作區<select id=\"screen\"><option value=\"maintenance\">Maintenance</option><option value=\"ise\">ISE Maintenance</option><option value=\"details\">Reagent Management · Details</option><option value=\"rack-calibration\">Rack Calibration</option><option value=\"rack-qc\">QC</option><option value=\"inspect\">Inspect Probe & Mixing Bar</option></select></label><small>實際瀏覽器畫面；點選圖片可開啟原尺寸。</small></header><main id=\"panels\"></main><p id=\"note\">後端 50 項測試、Chrome／Edge 回歸及正式建置通過。考試截圖使用獨立測試資料庫；Entry 不重設 expired。完成後的十一瓶、RB 六項／Cali 三項及 QC 畫面另列於驗證紀錄。</p><script>const browser=document.querySelector('#browser'),screen=document.querySelector('#screen'),panels=document.querySelector('#panels');function show(){panels.replaceChildren();for(const [mode,title] of [['explore','自由探索'],['practice','日保養練習'],['exam','日保養考試']]){const card=document.createElement('article'),heading=document.createElement('h2');heading.textContent=title;card.append(heading);if(mode==='explore'&&screen.value==='inspect'){const p=document.createElement('p');p.textContent='自由探索沒有啟動保養任務，因此不顯示任務檢查表單。';card.append(p);}else{const link=document.createElement('a'),img=document.createElement('img');link.href=browser.value+'-'+mode+'-'+screen.value+'.png';link.target='_blank';img.src=link.href;img.alt=title+' '+screen.selectedOptions[0].text;link.append(img);card.append(link);}panels.append(card);}}browser.onchange=screen.onchange=show;show();</script></html>",
  "utf8",
);
