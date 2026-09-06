const { chromium } = require('C:/Users/13166/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const out = 'D:/Projects/unknown-room-checks';
fs.mkdirSync(out, { recursive:true });
const delay = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const motion=process.env.ROOM_MOTION==='normal'?'no-preference':'reduce';
  const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:motion});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('file:///D:/Projects/unknown-room.html');
  const inspect=()=>page.evaluate(()=>UnknownRoom.inspect());
  const point=async(x,y)=>page.evaluate(({x,y})=>{const p=document.getElementById('board').createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(document.getElementById('board').getScreenCTM());return {x:q.x,y:q.y};},{x,y});
  const click=async(x,y)=>{const p=await point(x,y);await page.mouse.click(p.x,p.y);await delay(motion==='reduce'?80:500);};
  const pulse=async()=>{await delay(580);await page.locator('#pulse').click();await delay(80);};
  const stage=async(n)=>{await page.waitForFunction(n=>UnknownRoom.inspect().stage===n&&UnknownRoom.inspect().mode==='playing',n);assert.equal((await inspect()).stage,n);};
  const drag=async(x1,y1,x2,y2)=>{const a=await point(x1,y1),b=await point(x2,y2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:15});await page.mouse.up();await delay(100);};
  await page.screenshot({path:out+'/01-entry.png'});
  await page.locator('#enter').click();await stage(1);
  // A repeat of the same unsuccessful trial is tracked, with no state loss.
  await click(200,180);await pulse();await pulse();
  let s=await inspect();assert.equal(s.session.repeatedFailedConfigurations,1);assert.equal(s.nodes[0].lit,false);
  await page.locator('#reset').click();s=await inspect();assert.equal(s.session.stages[0].resets,1);assert.equal(s.halo.x,440);
  await page.screenshot({path:out+'/02-room-one.png'});
  // Space on the board is a real input path, not an engine shortcut.
  await page.locator('#board').focus();await page.keyboard.press('Space');await stage(2);
  await click(320,280);await pulse();s=await inspect();assert.equal(s.nodes[0].lit,true);assert.equal(s.stage,2);
  await click(650,390);await pulse();await stage(3);
  // Inner-band blue is intentionally ineffective; amber state persists independently.
  await pulse();s=await inspect();assert.equal(s.nodes[1].lit,false);
  await click(330,330);await pulse();s=await inspect();assert.equal(s.nodes[0].lit,true);
  await click(470,330);await page.screenshot({path:out+'/03-two-fields.png'});await pulse();await stage(4);
  // The original positions mathematically cannot satisfy the conjunction.
  s=await inspect();assert.ok(Math.abs(s.nodes[0].x-s.nodes[1].x)<104-64);
  await pulse();s=await inspect();assert.equal(s.stage,4);assert.ok(s.nodes.every(n=>!n.lit));
  await drag(386,330,490,330);s=await inspect();assert.ok(Math.abs(s.nodes[1].x-490)<1);assert.ok(s.nodes.every(n=>n.ready));
  await page.screenshot({path:out+'/04-conjunction.png'});await pulse();await stage(5);
  // First solve awakens the destination but must not finish the experiment.
  await click(500,330);s=await inspect();assert.ok(s.nodes.every(n=>n.ready));await pulse();s=await inspect();assert.equal(s.awake,true);assert.equal(s.mode,'playing');
  await pulse();s=await inspect();assert.equal(s.mode,'playing');assert.equal(s.nodes.find(n=>n.id==='gate').ready,false);
  await page.screenshot({path:out+'/05-awakened.png'});
  // Reset restores final phase as well as movable aperture position.
  await page.locator('#reset').click();s=await inspect();assert.equal(s.awake,false);assert.equal(s.gate.x,830);
  assert.equal(await page.locator('#gate').getAttribute('role'),null);
  await click(500,330);await pulse();await drag(830,330,500,330);s=await inspect();assert.ok(s.nodes.every(n=>n.ready));
  await page.screenshot({path:out+'/06-final-alignment.png'});await pulse();
  await page.waitForFunction(()=>UnknownRoom.inspect().mode==='debrief');
  assert.equal(await page.locator('.metric').count(),7);assert.equal(await page.locator('.room-tab').count(),5);
  s=await inspect();assert.equal(s.session.stages.length,5);assert.ok(s.session.stages.every(s=>s.end!==null));assert.equal(s.session.stages[4].resets,1);assert.ok(s.session.events.some(e=>e.type==='drag'&&e.target==='gate'));
  await page.screenshot({path:out+'/07-debrief.png',fullPage:true});
  await page.locator('#tab-4').click();assert.match(await page.locator('.path-copy').innerText(),/apparent exit/);
  const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs(out+'/session.json');assert.equal(JSON.parse(fs.readFileSync(out+'/session.json')).events.length,s.session.events.length);
  await page.locator('#restart').click();await stage(1);s=await inspect();assert.equal(s.session.events.length,0);
  // Held keyboard movement is one gesture and cannot drift after release.
  await page.locator('#board').focus();await page.keyboard.down('ArrowLeft');await delay(300);await page.keyboard.up('ArrowLeft');s=await inspect();assert.ok(s.halo.x<400);assert.equal(s.session.events.filter(e=>e.type==='move').length,1);
  const x=s.halo.x;await delay(150);assert.ok(Math.abs((await inspect()).halo.x-x)<1);
  // Mobile viewport: no overflow, all controls visible, touch paths work.
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  mobile.on('pageerror',e=>errors.push(String(e)));await mobile.goto('file:///D:/Projects/unknown-room.html');await mobile.screenshot({path:out+'/08-mobile-entry.png'});await mobile.locator('#enter').tap();
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mobile.screenshot({path:out+'/09-mobile-room.png'});await mobile.locator('#pulse').tap();await mobile.waitForFunction(()=>UnknownRoom.inspect().stage===2);
  // Check optional audio off state persists and does not affect mechanics.
  await mobile.locator('#sound').tap();assert.equal(await mobile.locator('#sound').getAttribute('aria-pressed'),'false');
  const mobilePoint=async(x,y)=>mobile.evaluate(({x,y})=>{const svg=document.getElementById('board'),p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(svg.getScreenCTM());return{x:q.x,y:q.y};},{x,y});
  const tap=async(x,y)=>{const p=await mobilePoint(x,y);await mobile.touchscreen.tap(p.x,p.y);await delay(80);};
  const mobilePulse=async()=>{await delay(580);await mobile.locator('#pulse').tap();await delay(80);};
  const mobileStage=async(n)=>mobile.waitForFunction(n=>UnknownRoom.inspect().stage===n&&UnknownRoom.inspect().mode==='playing',n);
  const cdp=await mobile.context().newCDPSession(mobile);
  const touchDrag=async(x1,y1,x2,y2)=>{const a=await mobilePoint(x1,y1),b=await mobilePoint(x2,y2);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/12,y:a.y+(b.y-a.y)*i/12,id:1}]});}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(80);};
  await tap(320,280);await mobilePulse();await tap(650,390);await mobilePulse();await mobileStage(3);
  await tap(330,330);await mobilePulse();await tap(470,330);await mobilePulse();await mobileStage(4);
  await touchDrag(386,330,490,330);assert.ok((await mobile.evaluate(()=>UnknownRoom.inspect())).nodes.every(n=>n.ready));await mobilePulse();await mobileStage(5);
  await tap(500,330);await mobilePulse();await touchDrag(830,330,500,330);await mobilePulse();await mobile.waitForFunction(()=>UnknownRoom.inspect().mode==='debrief');
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mobile.screenshot({path:out+'/10-mobile-debrief.png',fullPage:true});
  // No AudioContext is a supported fallback, without blocking entry or a solve.
  const silent=await browser.newPage({reducedMotion:'reduce'});await silent.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});silent.on('pageerror',e=>errors.push(String(e)));await silent.goto('file:///D:/Projects/unknown-room.html');await silent.click('#enter');await silent.click('#pulse');await silent.waitForFunction(()=>UnknownRoom.inspect().stage===2);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/results.json',JSON.stringify({passed:true,motion,checks:['five-stage desktop playthrough','five-stage mobile touch playthrough','informative failure','repeat tracking','keyboard pulse','persistent latch','impossible initial conjunction','node dragging','two-step final reversal','final reset recovery','timeline tabs','JSON export','fresh session','held-key grouping','mobile fit','audio toggle','no-audio fallback','zero browser errors'],events:JSON.parse(fs.readFileSync(out+'/session.json')).events.length},null,2));
  console.log('PASS: all five stages on desktop and mobile, reset recovery, metrics, export, keyboard, audio fallback; no browser errors. Motion: '+motion);
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
