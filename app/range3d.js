/* =========================================================
   三角洲靶场 · 3D 靶场场景 (three.js)
   依赖: three.min.js (全局 THREE) + 改枪脚本 (window.GS)
   ========================================================= */
"use strict";
const G_ = window.GS;


/* ---------------- 弹道/伤害（与 2D 版一致） ---------------- */
const ARMOR_ABSORB  = [0, .12, .18, .25, .32, .38, .44];
const HELMET_ABSORB = [0, .20, .28, .35, .42, .48, .55];
const DIST_PRESETS = [
  {key:"RT1", dist:25}, {key:"RT2", dist:50}, {key:"RT3", dist:100},
  {key:"RT4", dist:150}, {key:"RT5", dist:200},
];
const GRAV = 9.8;

const rs = {
  dist: 25, distCustom: 25, useCustom: false,
  hp: 100, helmet: 0, armor: 0, dmgHint: true,
  fireMode: "auto", sens: 14, moveTarget: false, sfxOn: true,
};
try{ Object.assign(rs, JSON.parse(localStorage.getItem("df_range_cfg3d")||"{}")); }catch(e){}
function syncLS(){ localStorage.setItem("df_range_cfg3d", JSON.stringify(rs)); }

function curDist(){ return rs.useCustom ? Math.max(1, Math.min(230, rs.distCustom)) : DIST_PRESETS[G_.state.rangeIdx].dist; }
function curWeapon(){ return G_.WEAPONS.find(w=>w.id===G_.state.weaponId); }
function curStats(){ return G_.calcStats(curWeapon(), G_.state.build); }
function dropAt(d, v0){ return 0.5*GRAV*(d/v0)*(d/v0); }
function hitDamage(baseDmg, dist, zone, s){
  let dmg = baseDmg;
  if(dist > s.eff){
    const over = (dist - s.eff) / Math.max(20, s.eff);
    dmg *= Math.max(0.4, 1 - 0.15*Math.ceil(over/0.5));
  }
  const w = curWeapon();
  let mult = 1;
  if(zone === "head") mult = w.hd;
  else if(zone === "stomach") mult = 0.9;
  else if(zone === "limb") mult = 0.75;
  dmg *= mult;
  let absorb = zone==="head" ? HELMET_ABSORB[rs.helmet]
             : (zone==="chest"||zone==="stomach") ? ARMOR_ABSORB[rs.armor] : 0;
  if(absorb > 0){
    const zoneLv = zone==="head" ? rs.helmet : rs.armor;
    const penDeficit = Math.max(0, zoneLv - s.pen);
    absorb = Math.min(0.85, absorb + penDeficit*0.06);
    dmg *= (1 - absorb);
  }
  return Math.max(1, Math.round(dmg));
}
function ttkChest(s){
  const dmg = hitDamage(s.dmg, curDist(), "chest", s);
  const n = Math.ceil(rs.hp / dmg);
  return {n, t:(n-1)*60/s.rpm, dmg};
}

/* ---------------- 音效（WebAudio 合成） ---------------- */
const sfx = {
  ctx:null, noise:null,
  ensure(){
    if(this.ctx) return;
    try{
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      const len = this.ctx.sampleRate*0.18;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2.2);
      this.noise = buf;
    }catch(e){}
  },
  shot(cls, suppressed){
    if(!rs.sfxOn) return;
    this.ensure(); if(!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type="lowpass";
    f.frequency.value = suppressed ? 700 : (cls==="狙击枪"?420: cls==="轻机枪"?650: cls==="冲锋枪"?1500:900);
    const g = c.createGain();
    const vol = suppressed ? 0.10 : (cls==="狙击枪"?0.5:0.32);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t+ (suppressed?0.10:0.18));
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
    if(!suppressed){
      const o = c.createOscillator(), og = c.createGain();
      o.type="triangle"; o.frequency.setValueAtTime(110,t);
      o.frequency.exponentialRampToValueAtTime(48, t+0.09);
      og.gain.setValueAtTime(0.16,t); og.gain.exponentialRampToValueAtTime(0.001,t+0.1);
      o.connect(og); og.connect(c.destination); o.start(t); o.stop(t+0.12);
    }
  },
  click(){ this.ensure(); if(!this.ctx||!rs.sfxOn) return;
    const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();
    o.type="square"; o.frequency.value=1800; g.gain.setValueAtTime(0.05,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.04);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+0.05);
  },
  reload(){ this.ensure(); if(!this.ctx||!rs.sfxOn) return;
    [0,0.35,1.4].forEach((dt,i)=>{
      const c=this.ctx,t=c.currentTime+dt,o=c.createOscillator(),g=c.createGain();
      o.type="square"; o.frequency.value=600+i*250; g.gain.setValueAtTime(0.06,t);
      g.gain.exponentialRampToValueAtTime(0.001,t+0.06);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+0.07);
    });
  }
};

/* ---------------- three 场景 ---------------- */
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f14);
scene.fog = new THREE.Fog(0x0b0f14, 80, 340);

const camera = new THREE.PerspectiveCamera(75, 2, 0.04, 900);
scene.add(camera);

scene.add(new THREE.HemisphereLight(0x9db4c9, 0x181b20, 1.0));
const sun = new THREE.DirectionalLight(0xfff0d6, 1.1);
sun.position.set(-14, 30, -10); scene.add(sun);
const lampMid = new THREE.PointLight(0xcfe0f0, 0.5, 130); lampMid.position.set(0, 5.4, 90); scene.add(lampMid);
const lampFar = new THREE.PointLight(0xcfe0f0, 0.45, 130); lampFar.position.set(0, 5.4, 190); scene.add(lampFar);
const muzzleLight = new THREE.PointLight(0xffc36e, 0, 9); camera.add(muzzleLight);
muzzleLight.position.set(0.22, -0.16, -0.9);

/* ---- 材质工具 ---- */
function mat(color, opt){ return new THREE.MeshStandardMaterial(Object.assign({color, roughness:0.92, metalness:0.04}, opt||{})); }
function canvasTex(w, h, draw){
  const c = document.createElement("canvas"); c.width=w; c.height=h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function textSprite(text, size, color, sub){
  const t = canvasTex(256, 128, (g)=>{
    g.font = "bold 72px Consolas"; g.textAlign="center"; g.textBaseline="middle";
    g.fillStyle = color; g.fillText(text, 128, sub?48:64);
    if(sub){ g.font="28px 'Microsoft YaHei'"; g.fillStyle="rgba(220,225,235,.8)"; g.fillText(sub,128,100); }
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:t, transparent:true, depthWrite:false}));
  s.scale.set(size, size/2, 1);
  return s;
}

/* ---- 地图 ---- */
const envMeshes = [];
const RANGE_LEN = 250, RANGE_W = 24;
(function buildMap(){
  // 地板贴图
  const floorTex = canvasTex(512, 2048, (g,w,h)=>{
    g.fillStyle="#2c3138"; g.fillRect(0,0,w,h);
    for(let i=0;i<2600;i++){
      g.fillStyle = `rgba(255,255,255,${Math.random()*0.022})`;
      g.fillRect(Math.random()*w, Math.random()*h, 2, 2);
    }
    g.strokeStyle="rgba(255,154,31,.55)"; g.lineWidth=3;
    g.beginPath(); g.moveTo(w/2,0); g.lineTo(w/2,h); g.stroke();          // 中线弹道
    g.strokeStyle="rgba(0,0,0,.5)"; g.lineWidth=2;
    for(let i=1;i<6;i++){ g.beginPath(); g.moveTo(w*i/6,0); g.lineTo(w*i/6,h); g.stroke(); } // 分道线
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RANGE_W, RANGE_LEN+30),
    new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95}));
  floor.rotation.x = -Math.PI/2; floor.position.set(0, 0, 100);
  scene.add(floor); envMeshes.push(floor);

  // 侧墙 + 装饰灯带
  const wallMat = mat(0x232830);
  [-1,1].forEach(sx=>{
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.5, RANGE_LEN+30), wallMat);
    wall.position.set(sx*(RANGE_W/2+0.3), 3.25, 100);
    scene.add(wall); envMeshes.push(wall);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, RANGE_LEN+20),
      new THREE.MeshBasicMaterial({color:0xff9a1f, transparent:true, opacity:0.4}));
    strip.position.set(sx*(RANGE_W/2+0.02), 3.4, 100); scene.add(strip);
  });
  // 天花板 + 灯带
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RANGE_W, RANGE_LEN+30), mat(0x14171c));
  ceil.rotation.x = Math.PI/2; ceil.position.set(0, 6.5, 100); scene.add(ceil); envMeshes.push(ceil);
  for(let i=0;i<9;i++){
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 16),
      new THREE.MeshBasicMaterial({color:0xe9f1f8}));
    lamp.position.set(0, 6.4, -10 + i*30); scene.add(lamp);
  }
  // 射手位隔挡 + 台面
  const boothMat = mat(0x2e3540);
  [-3.4, 3.4].forEach(x=>{
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 2.0), boothMat);
    div.position.set(x, 1.05, -1.2); scene.add(div); envMeshes.push(div);
  });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.09, 0.9), mat(0x4a3b2a));
  shelf.position.set(0, 1.06, -1.5); scene.add(shelf); envMeshes.push(shelf);

  // 距离标线 + 牌
  DIST_PRESETS.forEach(p=>{
    const line = new THREE.Mesh(new THREE.PlaneGeometry(RANGE_W, 0.16),
      new THREE.MeshBasicMaterial({color:0xff9a1f, transparent:true, opacity:0.35}));
    line.rotation.x = -Math.PI/2; line.position.set(0, 0.012, p.dist); scene.add(line);
    const sp = textSprite(p.dist+"m", 2.2, "#ffb95c");
    sp.position.set(-RANGE_W/2+2.2, 2.6, p.dist-0.3); scene.add(sp);
    // 靶板
    const boardTex = canvasTex(256, 192, (g,w,h)=>{
      g.fillStyle="#11151c"; g.fillRect(0,0,w,h);
      g.strokeStyle="#3a4250"; g.lineWidth=6; g.strokeRect(6,6,w-12,h-12);
      g.font="bold 84px Consolas"; g.textAlign="center"; g.fillStyle="#556070";
      g.fillText(String(p.dist), w/2, h/2+30);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.55),
      new THREE.MeshStandardMaterial({map:boardTex, roughness:0.9}));
    board.position.set(0, 1.9, p.dist+0.35); scene.add(board); envMeshes.push(board);
    [-1.4,1.4].forEach(x=>{
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.12), mat(0x3a3f47));
      post.position.set(x, 1.6, p.dist+0.3); scene.add(post); envMeshes.push(post);
    });
  });

  // 底墙（挡弹墙）
  const back = new THREE.Mesh(new THREE.BoxGeometry(RANGE_W+4, 8, 0.8), mat(0x1b1f26));
  back.position.set(0, 4, 243); scene.add(back); envMeshes.push(back);
  const logo = textSprite("DELTA FORCE RANGE", 8, "#ff9a1f", "三角洲靶场 · 25m — 200m");
  logo.position.set(0, 4.6, 242.4); scene.add(logo);
})();

/* ---- 假人模型（分区命中） ---- */
const dummy = new THREE.Group();
const dummyHit = [];     // 可被击中的部位 mesh
const dummyMats = [];
let dummyDead = false, dummyFall = 0, hpFlash = 0;
(function buildDummy(){
  const cloth = mat(0x8e99a7); const skin = mat(0xb9a08c);
  dummyMats.push(cloth, skin);
  function part(geo, m, x,y,z, zone){
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x,y,z);
    mesh.userData.zone = zone;
    dummy.add(mesh);
    if(zone) dummyHit.push(mesh);
    return mesh;
  }
  const torso = part(new THREE.BoxGeometry(0.44, 0.34, 0.26), cloth, 0, 1.28, 0, "chest");
  const belly = part(new THREE.BoxGeometry(0.38, 0.28, 0.24), cloth, 0, 0.98, 0, "stomach");
  part(new THREE.BoxGeometry(0.36, 0.22, 0.24), cloth, 0, 0.78, 0, "stomach"); // 髋
  const head = part(new THREE.SphereGeometry(0.125, 18, 14), skin, 0, 1.62, 0, "head");
  part(new THREE.BoxGeometry(0.13, 0.16, 0.13), skin, 0, 1.47, 0, "head");   // 颈
  [-1,1].forEach(sx=>{
    const arm = part(new THREE.BoxGeometry(0.115, 0.56, 0.115), cloth, sx*0.30, 1.22, 0, "limb");
    arm.rotation.z = sx*0.10;
    part(new THREE.BoxGeometry(0.10, 0.14, 0.10), skin, sx*0.345, 0.90, 0, "limb"); // 手
    const leg = part(new THREE.BoxGeometry(0.16, 0.80, 0.16), cloth, sx*0.115, 0.42, 0, "limb");
    part(new THREE.BoxGeometry(0.17, 0.09, 0.26), mat(0x2c2f34), sx*0.115, 0.045, 0.04, "limb"); // 靴
  });
  // 护甲插板（随等级显隐）
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.36, 0.05), mat(0x39424e, {metalness:0.3, roughness:0.6}));
  plate.position.set(0, 1.26, 0.15); plate.userData.zone = "chest";
  dummy.add(plate); dummyHit.push(plate); dummy.userData.plate = plate;
  // 头盔（随等级显隐）
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12, 0, Math.PI*2, 0, Math.PI*0.62),
    mat(0x46505c, {metalness:0.35, roughness:0.5}));
  helmet.position.set(0, 1.635, 0); helmet.userData.zone = "head";
  dummy.add(helmet); dummyHit.push(helmet); dummy.userData.helmet = helmet;
  scene.add(dummy);
})();
function refreshDummyGear(){
  dummy.userData.plate.visible = rs.armor > 0;
  dummy.userData.helmet.visible = rs.helmet > 0;
  const col = [0,0x7c8894,0x6fa5d8,0x5d8fc9,0x4d7db8,0x3d6ba6,0x2d5994];
  if(rs.armor>0) dummy.userData.plate.material.color.setHex(col[rs.armor]||0x5d8fc9);
  if(rs.helmet>0) dummy.userData.helmet.material.color.setHex(col[rs.helmet]||0x5d8fc9);
}

/* ---- 枪械视图模型 ---- */
const gun = new THREE.Group();
const gunKick = {t:0};
(function buildGun(){
  const gm = new THREE.MeshStandardMaterial({color:0x2b2e34, roughness:0.45, metalness:0.55});
  const gm2 = new THREE.MeshStandardMaterial({color:0x1d2025, roughness:0.6, metalness:0.3});
  const recv = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.085, 0.42), gm); recv.position.set(0, 0, -0.06);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.44, 10), gm2);
  barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.012, -0.48);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.24), gm2); hand.position.set(0, -0.005, -0.32);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.17, 0.085), gm2); mag.position.set(0, -0.12, -0.01); mag.rotation.x = 0.12;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.06), gm2); grip.position.set(0, -0.10, 0.12); grip.rotation.x = -0.3;
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.24), gm); stock.position.set(0, -0.015, 0.26);
  const sight = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0045, 8, 20), gm2);
  sight.position.set(0, 0.075, -0.12);
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.02, 0.006), gm2); front.position.set(0, 0.075, -0.55);
  gun.add(recv, barrel, hand, mag, grip, stock, sight, front);
  gun.userData.sightY = 0.075;
  camera.add(gun);
})();

/* ---- 特效池：弹孔 / 曳光 / 伤害飘字 ---- */
const holes = [], holesOnDummy = [];
const holeGeo = new THREE.CircleGeometry(0.016, 10);
const holeMat = new THREE.MeshBasicMaterial({color:0x090a0b, side:THREE.DoubleSide});
function addHole(point, normal, parentGroup, list){
  const h = new THREE.Mesh(holeGeo, holeMat);
  h.position.copy(point).addScaledVector(normal, 0.004);
  h.lookAt(point.clone().add(normal));
  (parentGroup||scene).add(h);
  list.push(h);
  const cap = parentGroup ? 60 : 90;
  if(list.length > cap){ const old = list.shift(); old.parent.remove(old); }
}
const tracers = [];
for(let i=0;i<10;i++){
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({color:0xffd28a, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending}));
  l.visible = false; l.frustumCulled = false;
  scene.add(l); tracers.push({line:l, t:1, dur:1, from:new THREE.Vector3(), to:new THREE.Vector3(), sag:0});
}
const floaters = [];
for(let i=0;i<14;i++){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({transparent:true, depthWrite:false, depthTest:false}));
  s.visible = false; s.renderOrder = 99;
  scene.add(s); floaters.push({spr:s, t:1, v:new THREE.Vector3()});
}
function floatDmg(pos, text, color){
  const f = floaters.find(f=>f.t>=1) || floaters[0];
  const c = document.createElement("canvas"); c.width=160; c.height=80;
  const g = c.getContext("2d");
  g.font = "bold 44px Consolas"; g.textAlign="center";
  g.fillStyle = color; g.strokeStyle="rgba(0,0,0,.8)"; g.lineWidth=6;
  g.strokeText(text, 80, 52); g.fillText(text, 80, 52);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  f.spr.material.map = tex; f.spr.material.needsUpdate = true;
  f.spr.position.copy(pos); f.spr.scale.set(0.7, 0.35, 1);
  f.spr.visible = true; f.t = 0;
  f.v.set((Math.random()-0.5)*0.3, 0.85, (Math.random()-0.5)*0.3);
}

/* ---------------- 玩家状态 ---------------- */
const player = {
  pos: new THREE.Vector3(0, 1.65, -8),
  vel: new THREE.Vector3(),
  yaw: Math.PI, pitch: 0,   // 面向 +z（靶区方向）
  recoilP: 0, recoilY: 0,
  ads: 0, adsHeld: false,
  ammo: 30, magSize: 30, reloading: 0,
  lastShot: 0, firing: false,
  locked: false,
  bobT: 0, moveAmt: 0,
};
let shots = 0, hits = 0;
const ray = new THREE.Raycaster(); ray.far = 420;

/* ---------------- 射击 ---------------- */
const _dir = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3();
function fire(){
  const s = curStats(), w = curWeapon();
  const now = performance.now();
  if(dummyDead){ showMsg("按 R 或点击 [重置假人] 复位"); return; }
  if(player.reloading > 0) return;
  if(player.ammo <= 0){ sfx.click(); reload(); return; }
  const interval = 60000/s.rpm + (w.bolt?700:0);
  if(now - player.lastShot < interval) return;
  player.lastShot = now;
  player.ammo--; shots++;

  // 后坐
  const adsF = player.ads > 0.5 ? 0.55 : 1;
  player.recoilP += (1 - s.rv/100)*0.052*adsF + 0.007;
  player.recoilY += (1 - s.rh/100)*0.030*adsF*(Math.random()*2-1);
  gunKick.t = 1;

  // 扩散
  const spreadDeg = w.spread ? w.spread*(player.ads>0.5?0.55:1) : null;
  const cone = spreadDeg!==null ? spreadDeg*Math.PI/180
             : (player.ads>0.5 ? 0.0012 : (0.005 + (1-s.stab/100)*0.007) * (1-(s.hipBonus||0)/50) * (1+player.moveAmt*1.2));
  camera.getWorldDirection(_dir);
  _right.setFromMatrixColumn(camera.matrixWorld, 0);
  _up.setFromMatrixColumn(camera.matrixWorld, 1);

  // 弹道下坠补偿（两段射线）
  let d0 = 200;
  ray.set(camera.position, _dir);
  const pre = ray.intersectObjects(dummyHit.concat(envMeshes), false);
  if(pre.length) d0 = pre[0].distance;
  const drop = dropAt(d0, s.v0);
  const dropAng = Math.atan2(drop, d0);
  const finalDir = _dir.clone().addScaledVector(_up, -dropAng).normalize();

  ray.set(camera.position, finalDir);
  const hitsArr = ray.intersectObjects(dummyHit.concat(envMeshes), false);
  const hit = hitsArr[0];
  if (window.__fireDbg) window.__fireDbg.push({
    pre: pre.length ? +pre[0].distance.toFixed(2) : null,
    preObj: pre.length ? (pre[0].object.geometry ? pre[0].object.geometry.type + "@" + pre[0].object.position.toArray().map(v => +v.toFixed(1)).join(",") + "/p=" + pre[0].object.parent.type : "?") : null,
    n: hitsArr.length,
    d: hit ? +hit.distance.toFixed(2) : null,
    zone: hit ? (hit.object.userData.zone || "env") : null,
    camY: +camera.position.y.toFixed(2)
  });
  const end = hit ? hit.point.clone() : camera.position.clone().addScaledVector(finalDir, 240);

  muzzleLight.intensity = 2.6;
  sfx.shot(w.cls, (G_.state.build.muzzle && G_.state.build.muzzle.name.includes("消音")));

  // 曳光
  const tr = tracers.find(t=>t.t>=1) || tracers[0];
  const mzl = camera.localToWorld(new THREE.Vector3(0.14, -0.12, -0.75));
  tr.from.copy(mzl); tr.to.copy(end);
  tr.sag = drop*0.5; tr.t = 0; tr.dur = Math.min(0.9, Math.max(0.05, d0/s.v0));
  tr.line.visible = true;

  if(hit){
    const zone = hit.object.userData.zone;
    if(zone){
      const dmg = hitDamage(s.dmg, hit.distance, zone, s);
      hits++;
      rs.hpLeft = Math.max(0, (rs.hpLeft===undefined?rs.hp:rs.hpLeft) - dmg);
      addHole(hit.point, hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0,0,1), dummy, holesOnDummy);
      if(rs.dmgHint){
        floatDmg(hit.point.clone().addScaledVector(_up,0.08), String(dmg), zone==="head"?"#ff5d5d":"#ffb95c");
        pushDmg(dmg, zone, rs.hpLeft<=0);
      }
      hitmarker();
      hpFlash = 1;
      if(rs.hpLeft <= 0 && !dummyDead){ killDummy(); }
    } else {
      const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0,1,0);
      addHole(hit.point, n, null, holes);
    }
  }
  if(player.ammo === 0) reload();
}
function killDummy(){
  dummyDead = true; rs.hpLeft = 0;
  showMsg("目标击毁");
  pushDmg("", "kill", true);
}
function resetTarget(){
  dummyDead = false; rs.hpLeft = rs.hp; dummyFall = 0;
  dummy.rotation.x = 0; dummy.position.x = 0;
  holesOnDummy.forEach(h=>h.parent && h.parent.remove(h)); holesOnDummy.length = 0;
  showMsg("");
  updateHUDOnce();
}
function reload(){
  if(player.reloading > 0 || player.ammo === player.magSize) return;
  const s = curStats();
  const t = 2.6 * (1 + (100 - s.erg)/200);
  player.reloading = t;
  sfx.reload();
  showMsg("换弹中…");
  setTimeout(()=>{ player.ammo = player.magSize; player.reloading = 0; showMsg(""); }, t*1000);
}
function pushDmg(dmg, zone, kill){
  const el = document.createElement("div");
  el.className = "dmgpop" + (kill?" kill":"");
  const zn = {head:"头部",chest:"胸部",stomach:"腹部",limb:"四肢",kill:""}[zone]||"";
  el.textContent = kill ? "目标击毁" : `${zn} -${dmg}`;
  const log = document.getElementById("dmg-log");
  log.prepend(el);
  setTimeout(()=>el.remove(), 2500);
  while(log.children.length>7) log.lastChild.remove();
}
let msgT = 0;
function showMsg(t){ document.getElementById("hud-msg").textContent = t; msgT = t?2.4:0; }
function hitmarker(){
  const el = document.getElementById("hitmarker");
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.remove("show"), 90);
}

/* ---------------- 输入 ---------------- */
canvas.addEventListener("mousedown", e=>{
  if(!player.locked){
    try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (err) {}
  }
  if(dummyDead) return;
  if(KB.eq(KB.mouseName(e), KB.get("Fire"))){
    player.firing = true;
    fire();
  }
});
window.addEventListener("mouseup", e=>{
  if(KB.eq(KB.mouseName(e), KB.get("Fire"))) player.firing = false;
});
canvas.addEventListener("contextmenu", e=>e.preventDefault());
document.addEventListener("pointerlockchange", ()=>{
  player.locked = document.pointerLockElement === canvas;
  document.getElementById("gl-lock").classList.toggle("hide", player.locked);
});
window.addEventListener("mousemove", e=>{
  if(player.locked){
    const sens = rs.sens * 0.00022 * (player.ads>0.5 ? 0.55 : 1);
    player.yaw   -= e.movementX * sens;
    player.pitch -= e.movementY * sens;
  }
  player.pitch = Math.max(-1.35, Math.min(1.2, player.pitch));
});
// 已移除未锁定时的兜底瞄准：鼠标仅在指针锁定后才控制视角
window.addEventListener("keydown", e=>{
  if(!document.getElementById("pg-range").classList.contains("on")) return;
  if(e.repeat) return;
  const kn = KB.keyName(e);
  if(KB.eq(kn, KB.get("Reload"))){
    if(dummyDead) resetTarget(); else reload();
  } else if(KB.eq(kn, KB.get("Fire"))){
    if(!dummyDead && !player.firing) fire();   // 键位改绑到键盘后仍可单发/拉栓
  } else if(KB.eq(kn, KB.get("SwitchWeaponFireMode"))){
    rs.fireMode = rs.fireMode==="auto" ? "single" : "auto";
    document.getElementById("fire-mode").value = rs.fireMode;
    syncLS(); updateHUDOnce();
  } else if(KB.eq(kn, KB.get("RangeToggleAnalysisPanel"))){
    e.preventDefault();
    const m = document.getElementById("bal-modal");
    if(m.classList.contains("on")) m.classList.remove("on");
    else showBallistic();
  } else if(KB.eq(kn, KB.get("RangeManageWeapon"))){
    e.preventDefault();
    window.switchPage("pg-gun");               // 靶场武器管理 → 回到改枪工坊
  }
});
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  if(rs.useCustom){
    rs.distCustom = Math.max(1, Math.min(230, rs.distCustom + (e.deltaY<0?5:-5)));
    document.getElementById("dist-custom").value = rs.distCustom;
  } else {
    G_.state.rangeIdx = Math.max(0, Math.min(DIST_PRESETS.length-1, G_.state.rangeIdx + (e.deltaY<0?1:-1)));
    renderDistBtns();
  }
  syncLS(); updateHUDOnce();
}, {passive:false});

/* ---------------- 主循环 ---------------- */
const clock = new THREE.Clock();
let running = false;
let tickCount = 0;
function tick(){
  tickCount++;
  if(!document.getElementById("pg-range").classList.contains("on")) return;
  const dt = Math.min(0.05, clock.getDelta());
  const now = performance.now();
  const s = curStats(), w = curWeapon();

  // 连发（开火键支持键位改绑，含鼠标/键盘）
  player.firing = KB.down("Fire");
  if(player.firing && !dummyDead){
    const interval = 60000/s.rpm + (w.bolt?700:0);
    if(now - player.lastShot >= interval && (rs.fireMode==="auto" && !w.semi && !w.bolt)) fire();
  }

  // 开镜（开镜键支持键位改绑）
  player.adsHeld = KB.down("ToggleAiming");
  const adsT = player.adsHeld && !dummyDead ? 1 : 0;
  player.ads += (adsT - player.ads) * Math.min(1, dt*12);
  const fov = 75 - 30*player.ads;
  if(Math.abs(camera.fov - fov) > 0.01){ camera.fov = fov; camera.updateProjectionMatrix(); }

  // 移动
  // 移动（方向/冲刺键支持键位改绑）
  const speed = (KB.down("Sprint") ? 2.2 : 4.4) * (1 - (100 - s.mob)/260) * (player.ads>0.5?0.55:1);
  const f = (KB.down("MoveForwardAction")?1:0)-(KB.down("MoveBackwardAction")?1:0);
  const r = (KB.down("MoveRightAction")?1:0)-(KB.down("MoveLeftAction")?1:0);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const wishX = (r*cos - f*sin), wishZ = (-f*cos - r*sin);
  const wl = Math.hypot(wishX, wishZ)||1;
  player.vel.x += ((wishX/wl)*speed*(f||r?1:0) - player.vel.x) * Math.min(1, dt*10);
  player.vel.z += ((wishZ/wl)*speed*(f||r?1:0) - player.vel.z) * Math.min(1, dt*10);
  player.pos.x += player.vel.x*dt; player.pos.z += player.vel.z*dt;
  player.pos.x = Math.max(-9.5, Math.min(9.5, player.pos.x));
  player.pos.z = Math.max(-12, Math.min(10, player.pos.z));
  player.moveAmt = Math.min(1, Math.hypot(player.vel.x, player.vel.z)/4.4);
  player.bobT += dt * (6 + player.moveAmt*6);

  // 后坐恢复
  player.recoilP *= Math.exp(-7*dt);
  player.recoilY *= Math.exp(-7*dt);
  muzzleLight.intensity *= Math.exp(-16*dt);

  // 相机
  camera.position.copy(player.pos);
  camera.position.y = player.pos.y + Math.sin(player.bobT*2)*0.012*player.moveAmt;
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw + player.recoilY;
  camera.rotation.x = player.pitch + player.recoilP;

  // 枪械视图模型
  gunKick.t *= Math.exp(-12*dt);
  const hip = {x:0.26, y:-0.24, z:-0.5}, ads = {x:0, y:-0.075-gun.userData.sightY+0.075, z:-0.34};
  ads.y = -gun.userData.sightY;
  const a = player.ads;
  gun.position.set(
    hip.x + (ads.x-hip.x)*a,
    hip.y + (ads.y-hip.y)*a + Math.sin(player.bobT*2)*0.008*player.moveAmt*(1-a),
    hip.z + (ads.z-hip.z)*a + gunKick.t*0.06
  );
  gun.rotation.x = gunKick.t*0.10 + (player.ads>0.5?0:0.02);
  gun.visible = true;

  // 假人
  const targetZ = curDist();
  dummy.position.z += (targetZ - dummy.position.z) * Math.min(1, dt*4);
  let tx = 0;
  if(rs.moveTarget && !dummyDead) tx = Math.sin(now*0.0009) * Math.min(3.2, 1 + targetZ*0.015);
  dummy.position.x += (tx - dummy.position.x) * Math.min(1, dt*2.5);
  if(dummyDead && dummyFall < 1){
    dummyFall = Math.min(1, dummyFall + dt*2.2);
    dummy.rotation.x = -1.38 * (1 - Math.pow(1-dummyFall, 2));
  }
  if(hpFlash > 0){
    hpFlash = Math.max(0, hpFlash - dt*4);
    dummyMats.forEach(m=>m.emissive.setRGB(hpFlash*0.5, 0, 0));
  }
  // 面向射手
  dummy.rotation.y = 0;

  // 曳光
  tracers.forEach(t=>{
    if(t.t >= 1){ t.line.visible = false; return; }
    t.t = Math.min(1, t.t + dt/Math.max(0.05, t.dur));
    const tt = t.t, p = new THREE.Vector3().lerpVectors(t.from, t.to, tt);
    p.y -= t.sag * 4*tt*(1-tt);
    const pos = t.line.geometry.attributes.position;
    pos.setXYZ(0, t.from.x, t.from.y, t.from.z);
    pos.setXYZ(1, p.x, p.y, p.z);
    pos.needsUpdate = true;
    t.line.material.opacity = 0.9*(1-tt*0.5);
  });
  // 飘字
  floaters.forEach(f=>{
    if(f.t >= 1){ f.spr.visible = false; return; }
    f.t = Math.min(1, f.t + dt/0.9);
    f.spr.position.addScaledVector(f.v, dt);
    f.spr.material.opacity = 1 - f.t;
  });

  // 准星
  const gap = 8 + (1-s.stab/100)*14 + player.moveAmt*10 + (1-player.ads)*10;
  updateCrosshair(gap, player.ads);

  // HUD
  if(msgT > 0){ msgT -= dt; if(msgT<=0) showMsg(""); }
  updateHUDOnce();

  renderer.render(scene, camera);
}

function updateCrosshair(gap, ads){
  const ch = document.getElementById("crosshair");
  if(ads > 0.6){ ch.style.display = "none"; return; }
  ch.style.display = "block";
  if(!ch._built){
    ch._built = true;
    ch.innerHTML = `<span id="ch-t"></span><span id="ch-b"></span><span id="ch-l"></span><span id="ch-r"></span>`;
    const st = document.createElement("style");
    st.textContent = `#ch-t,#ch-b{width:2px;height:9px;left:-1px}#ch-l,#ch-r{width:9px;height:2px;top:-1px}`;
    document.head.appendChild(st);
  }
  const t=document.getElementById("ch-t"),b=document.getElementById("ch-b"),
        l=document.getElementById("ch-l"),r=document.getElementById("ch-r");
  t.style.transform=`translateY(${-gap-9}px)`; b.style.transform=`translateY(${gap}px)`;
  l.style.transform=`translateX(${-gap-9}px)`; r.style.transform=`translateX(${gap}px)`;
}

let hudT = 0;
function updateHUDOnce(){
  const s = curStats();
  const hp = rs.hpLeft===undefined ? rs.hp : rs.hpLeft;
  document.getElementById("hud-dist").textContent = curDist()+"m";
  document.getElementById("hud-armor").textContent = rs.armor?rs.armor+"级":"无";
  document.getElementById("hud-helmet").textContent = rs.helmet?rs.helmet+"级":"无";
  document.getElementById("hud-fmode").textContent = rs.fireMode==="auto"?"全自动":"单发";
  document.getElementById("hud-ads").textContent = player.ads>0.5?"开镜":"腰射";
  document.getElementById("hud-ammo").innerHTML =
    (player.reloading>0 ? "--" : player.ammo) + ` <small>/ ${player.magSize}</small>`;
  document.getElementById("hud-hptext").textContent = `假人 ${Math.round(hp)} / ${rs.hp}`;
  document.querySelector("#hud-hpbar i").style.width = (hp/rs.hp*100)+"%";
  document.getElementById("r-shots2").textContent = `${shots} / ${hits}`;
  const tt = ttkChest(s);
  document.getElementById("r-ttk").textContent = `${tt.n}发 · ${tt.t.toFixed(2)}s (${tt.dmg}/发)`;
  document.getElementById("r-dps").textContent = (tt.dmg*s.rpm/60).toFixed(0);
  const tof = curDist()/s.v0;
  document.getElementById("r-tof").textContent = (tof*1000).toFixed(0)+" ms";
  document.getElementById("r-drop").textContent = (dropAt(curDist(), s.v0)*100).toFixed(1)+" cm";
  document.getElementById("r-shots").textContent = `${shots} / ${hits}`;
  document.getElementById("r-wname").textContent = curWeapon().name + " · " + s.mag + "发 · ¥" + G_.fmt(s.price);
}

/* ---------------- 设置面板 ---------------- */
function renderDistBtns(){
  const box = document.getElementById("dist-btns");
  box.innerHTML = DIST_PRESETS.map((d,i)=>
    `<div class="dbtn ${!rs.useCustom&&G_.state.rangeIdx===i?'on':''}" data-i="${i}">${d.key}<br><span style="font-size:10px;opacity:.7">${d.dist}m</span></div>`
  ).join("") + `<div class="dbtn ${rs.useCustom?'on':''}" data-i="c">自定义</div>`;
  box.querySelectorAll(".dbtn").forEach(el=>el.onclick=()=>{
    if(el.dataset.i==="c"){ rs.useCustom = true; document.getElementById("dist-custom").focus(); }
    else { rs.useCustom = false; G_.state.rangeIdx = +el.dataset.i; }
    renderDistBtns(); syncLS(); updateHUDOnce();
  });
  document.getElementById("dist-val").textContent = curDist()+"m";
}
function initRangeUI(){
  const lv = n=>Array.from({length:n+1},(_,i)=>`<option value="${i}">${i===0?"无":i+"级"}</option>`).join("");
  document.getElementById("helmet-lv").innerHTML = lv(6);
  document.getElementById("armor-lv").innerHTML = lv(6);
  document.getElementById("hp-range").value = rs.hp; document.getElementById("hp-val").textContent = rs.hp;
  document.getElementById("helmet-lv").value = rs.helmet;
  document.getElementById("armor-lv").value = rs.armor;
  document.getElementById("dmg-hint").checked = rs.dmgHint;
  document.getElementById("move-target").checked = rs.moveTarget;
  document.getElementById("sfx-on").checked = rs.sfxOn;
  document.getElementById("fire-mode").value = rs.fireMode;
  document.getElementById("sens").value = rs.sens;
  document.getElementById("dist-custom").value = rs.distCustom;
  G_.state.rangeIdx = G_.state.rangeIdx || 0;
  rs.hpLeft = rs.hp;

  document.getElementById("hp-range").oninput = e=>{ rs.hp=+e.target.value; document.getElementById("hp-val").textContent=e.target.value; resetTarget(); syncLS(); };
  document.getElementById("helmet-lv").onchange = e=>{ rs.helmet=+e.target.value; refreshDummyGear(); resetTarget(); syncLS(); };
  document.getElementById("armor-lv").onchange = e=>{ rs.armor=+e.target.value; refreshDummyGear(); resetTarget(); syncLS(); };
  document.getElementById("dmg-hint").onchange = e=>{ rs.dmgHint=e.target.checked; syncLS(); };
  document.getElementById("move-target").onchange = e=>{ rs.moveTarget=e.target.checked; syncLS(); };
  document.getElementById("sfx-on").onchange = e=>{ rs.sfxOn=e.target.checked; syncLS(); };
  document.getElementById("fire-mode").onchange = e=>{ rs.fireMode=e.target.value; syncLS(); };
  document.getElementById("sens").oninput = e=>{ rs.sens=+e.target.value; syncLS(); };
  document.getElementById("dist-custom").onchange = e=>{ rs.distCustom=+e.target.value||25; renderDistBtns(); syncLS(); };
  document.getElementById("btn-reset-target").onclick = resetTarget;
  document.getElementById("btn-clear-holes").onclick = ()=>{ holes.forEach(h=>h.parent&&h.parent.remove(h)); holes.length=0;
    holesOnDummy.forEach(h=>h.parent&&h.parent.remove(h)); holesOnDummy.length=0; shots=0; hits=0; };
  document.getElementById("btn-backgun").onclick = ()=>window.switchPage && window.switchPage("pg-gun");
  document.getElementById("btn-ballistic").onclick = showBallistic;
  document.getElementById("bal-close").onclick = ()=>document.getElementById("bal-modal").classList.remove("on");
  document.getElementById("gl-lock").onclick = ()=>{ try { canvas.requestPointerLock && canvas.requestPointerLock(); } catch (err) {} };
  renderDistBtns();
  refreshDummyGear();
  resetTarget();
}
function showBallistic(){
  const s = curStats();
  document.getElementById("bal-wname").textContent = curWeapon().name;
  let html = `<tr><th>距离</th><th>飞行时间</th><th>下坠</th><th>胸部伤害</th><th>头部伤害</th><th>护甲${rs.armor}级后</th></tr>`;
  const dists = [...new Set([25,50,100,150,200,curDist()])].sort((a,b)=>a-b);
  for(const d of dists){
    const tof = d/s.v0;
    const cd = hitDamage(s.dmg, d, "chest", s);
    const hd = hitDamage(s.dmg, d, "head", s);
    html += `<tr><td>${d}m</td><td>${(tof*1000).toFixed(0)}ms</td><td>${(dropAt(d,s.v0)*100).toFixed(1)}cm</td><td>${cd}</td><td>${hd}</td><td>${rs.armor?Math.round(cd*(1-ARMOR_ABSORB[rs.armor])):cd}</td></tr>`;
  }
  document.getElementById("bal-table").innerHTML = html;
  document.getElementById("bal-modal").classList.add("on");
}

/* ---------------- 页面/尺寸/武器变更 ---------------- */
function resize(){
  const box = document.getElementById("range-main");
  const w = box.clientWidth, h = box.clientHeight;
  if(w && h){ renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix(); }
}
window.addEventListener("resize", resize);
window.addEventListener("pagechange", e=>{
  if(e.detail === "pg-range"){ resize(); syncWeaponState(); }
});

/* ---------------- 键位说明（随键位设置实时更新） ---------------- */
function renderKeyHelp(){
  document.getElementById("range-help").textContent =
    KB.label("MoveForwardAction")+"/"+KB.label("MoveLeftAction")+"/"+KB.label("MoveBackwardAction")+"/"+KB.label("MoveRightAction")
    + " 移动 · " + KB.label("Sprint") + " 冲刺 · " + KB.label("Fire") + " 射击 · "
    + KB.label("ToggleAiming") + " 按住开镜 · " + KB.label("Reload") + " 换弹/重置假人 · "
    + KB.label("SwitchWeaponFireMode") + " 射击模式 · " + KB.label("RangeToggleAnalysisPanel")
    + " 弹道表 · ESC 释放鼠标 · 滚轮切换靶位";
}
KB.onChange = renderKeyHelp;
renderKeyHelp();
let lastWeaponSig = "";
function syncWeaponState(){
  const s = curStats();
  const sig = curWeapon().id + "|" + Object.values(G_.state.build).map(a=>a&&a.name).join(",");
  if(sig !== lastWeaponSig){
    lastWeaponSig = sig;
    player.magSize = s.mag; player.ammo = s.mag; player.reloading = 0;
    // 枪管长度按武器类型微调
    gun.children[1].scale.z = curWeapon().cls==="狙击枪"?1.5 : curWeapon().cls==="冲锋枪"?0.75 : 1;
  }
}

/* ---------------- 启动 ---------------- */
initRangeUI();
syncWeaponState();
resize();
tick();
// rAF 在部分环境（遮挡/后台窗口）会被节流，改用固定间隔驱动保证逻辑与渲染稳定
setInterval(tick, 16);

/* ---------------- 自测管线（#selftest） ---------------- */
if(location.hash === "#selftest"){
  setTimeout(()=>{
    if(window.dfNative) window.dfNative.reportSelftest("STARTED");
    const log = [];
    try{
      window.switchPage("pg-range");
      player.yaw = Math.PI;
      player.noFallbackAim = true;
      player.ads = 1; player.adsHeld = true;
      player.pitch = Math.atan2(1.28 - 1.65, curDist() + 8);
      // 同步相机与假人矩阵（不依赖 rAF）
      camera.position.copy(player.pos);
      camera.rotation.order = "YXZ";
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
      camera.updateMatrixWorld(true);
      dummy.position.set(0, 0, curDist());
      dummy.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);          // 强制全场景矩阵（防 rAF 节流下矩阵陈旧）
      try { renderer.render(scene, camera); } catch (e) {}
      const s0 = curStats(); player.ammo = s0.mag; player.magSize = s0.mag;
      const hp0 = rs.hpLeft;
      window.__fireDbg = [];
      for(let i=0;i<6;i++){ player.lastShot = 0; fire(); }
      log.push(["shots", shots, "hits", hits, "hp", rs.hpLeft, "ammo", player.ammo]);
      log.push(["fireDbg", window.__fireDbg ? window.__fireDbg.slice(0, 8) : "none"]);
      window.__fireDbg = [];
      // 射线级调试
      try{
        const d = new THREE.Vector3(); camera.getWorldDirection(d);
        ray.set(camera.position, d);
        const hd = ray.intersectObjects(dummyHit, false);
        log.push(["dbg", "cam", camera.position.toArray().map(v=>+v.toFixed(2)),
                  "rotY", +camera.rotation.y.toFixed(3), "rotX", +camera.rotation.x.toFixed(3),
                  "dir", d.toArray().map(v=>+v.toFixed(3)),
                  "dummyZ", +dummy.position.z.toFixed(2),
                  "dummyHits", hd.length,
                  "playerYaw", +player.yaw.toFixed(3), "pitch", +player.pitch.toFixed(3),
                  "lock", player.locked]);
      }catch(e2){ log.push(["dbgErr", String(e2)]); }
      const passA = shots>=6 && hits>=1 && rs.hpLeft < hp0;
      rs.armor = 6; refreshDummyGear(); resetTarget();
      const hpArmor0 = rs.hpLeft;
      player.pitch = Math.atan2(1.28 - 1.65, curDist() + 8);
      for(let i=0;i<8;i++){ player.lastShot = 0; fire(); }
      log.push(["armor6 hp", rs.hpLeft, "of", hpArmor0]);
      let guard = 0;
      while(!dummyDead && guard++ < 400){
        if(player.ammo <= 0){ player.ammo = player.magSize; player.reloading = 0; }
        player.lastShot = 0; fire();
      }
      log.push(["killed", dummyDead, "hits", hits, "hp", rs.hpLeft]);
      resetTarget();
      const passReset = !dummyDead && rs.hpLeft === rs.hp;
      console.log("SELFTEST " + JSON.stringify({
        passA, passReset, killed: dummyDead, hpAfterReset: rs.hpLeft,
        shots, hits, log, errors: window.__jsErrors || [], tickCount
      }));
      window.__selftestResult = JSON.stringify({
        passA, passReset, killed: dummyDead, hpAfterReset: rs.hpLeft,
        shots, hits, log, errors: window.__jsErrors || [], tickCount
      });
      if(window.dfNative) window.dfNative.reportSelftest(window.__selftestResult);
    }catch(err){
      const msg = JSON.stringify({fatal: String(err && err.stack || err)});
      console.log("SELFTEST " + msg);
      window.__selftestResult = msg;
      if(window.dfNative) window.dfNative.reportSelftest(msg);
    }
  }, 1200);
}
window.__jsErrors = [];
window.addEventListener("error", e=>window.__jsErrors.push(String(e.message)));
