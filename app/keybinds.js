/* =========================================================
   键位设置模块（独立界面）
   默认键位提取自 D:\Delta Force 提取资料/配置文件/Input.ini
   （[/Script/Engine.InputSettings] ActionMappings + DFHDKeySettingManager）
   依赖: 无（须在 range3d.js 之前加载，暴露 window.KB）
   ========================================================= */
"use strict";
window.KB = (function(){

  const LS_KEY = "df_keybinds_v1";

  /* ---------- 动作定义（名称/默认键均来自游戏 Input.ini） ---------- */
  const CATS = [
    {id:"move",   name:"移动"},
    {id:"combat", name:"战斗"},
    {id:"weapon", name:"武器"},
    {id:"range",  name:"靶场"},
  ];
  /* def = 游戏默认键（UE 键名）; rng = 靶场复刻中实际生效 */
  const ACTIONS = [
    /* 移动 */
    {id:"MoveForwardAction",  cat:"move",   name:"前进",          def:"W",                rng:true},
    {id:"MoveBackwardAction", cat:"move",   name:"后退",          def:"S",                rng:true},
    {id:"MoveLeftAction",     cat:"move",   name:"左移",          def:"A",                rng:true},
    {id:"MoveRightAction",    cat:"move",   name:"右移",          def:"D",                rng:true},
    {id:"JumpAndVault",       cat:"move",   name:"跳跃 / 翻越",   def:"SpaceBar"},
    {id:"ToggleCrouch",       cat:"move",   name:"蹲下（切换）",  def:"CapsLock"},
    {id:"ProneAndDive",       cat:"move",   name:"俯卧 / 潜水",   def:"LeftAlt"},
    {id:"SilentWalk",         cat:"move",   name:"静步",          def:"LeftControl"},
    {id:"Sprint",             cat:"move",   name:"冲刺",          def:"LeftShift",        rng:true},
    /* 战斗 */
    {id:"Fire",                   cat:"combat", name:"开火",           def:"LeftMouseButton", rng:true},
    {id:"ToggleAiming",           cat:"combat", name:"开镜瞄准",       def:"E",               rng:true},
    {id:"Reload",                 cat:"combat", name:"换弹",           def:"R",               rng:true},
    {id:"SwitchWeaponFireMode",   cat:"combat", name:"切换开火模式",   def:"I",               rng:true},
    {id:"WeaponInspect",          cat:"combat", name:"检视武器",       def:"B"},
    {id:"SwitchTacticlEquipment", cat:"combat", name:"切换战术装备",   def:"Y"},
    {id:"ChangeFOV",              cat:"combat", name:"视距切换",       def:"Q"},
    {id:"LeftLeanPeek",           cat:"combat", name:"左侧身",         def:"ThumbMouseButton2"},
    {id:"RightLeanPeek",          cat:"combat", name:"右侧身",         def:"ThumbMouseButton"},
    /* 武器 */
    {id:"SwitchToWeapon1",   cat:"weapon", name:"主武器 1",   def:"One"},
    {id:"SwitchToWeapon2",   cat:"weapon", name:"主武器 2",   def:"Two"},
    {id:"SwitchToWeapon3",   cat:"weapon", name:"主武器 3",   def:"Three"},
    {id:"SwitchToWeapon4",   cat:"weapon", name:"主武器 4",   def:"Four"},
    {id:"SwitchToPreWeapon", cat:"weapon", name:"上一件武器", def:"MouseScrollUp"},
    {id:"SwitchToNextWeapon",cat:"weapon", name:"下一件武器", def:"MouseScrollDown"},
    /* 靶场（游戏 Range_* ActionMappings） */
    {id:"RangeManageWeapon",               cat:"range", name:"靶场武器管理",   def:"Tab", rng:true},
    {id:"RangeToggleAnalysisPanel",        cat:"range", name:"弹道分析面板",   def:"P",   rng:true},
    {id:"RangeRefreshAnalysisPanel",       cat:"range", name:"刷新分析面板",   def:"O"},
    {id:"RangeToggleAnalysisDetailedPanel",cat:"range", name:"弹道分析详情",   def:"L"},
  ];
  const ACTION_BY_ID = {};
  ACTIONS.forEach(a=>ACTION_BY_ID[a.id]=a);

  /* ---------- UE 键名 <-> 浏览器事件 ---------- */
  const CODE2KEY = {
    Space:"SpaceBar", CapsLock:"CapsLock", Tab:"Tab", Escape:"Escape", Enter:"Enter",
    Backspace:"Backspace", Delete:"Delete", Insert:"Insert", Home:"Home", End:"End",
    PageUp:"PageUp", PageDown:"PageDown",
    ShiftLeft:"LeftShift", ShiftRight:"RightShift",
    ControlLeft:"LeftControl", ControlRight:"RightControl",
    AltLeft:"LeftAlt", AltRight:"RightAlt",
    ArrowUp:"Up", ArrowDown:"Down", ArrowLeft:"Left", ArrowRight:"Right",
    Minus:"Minus", Equal:"Equals", NumpadAdd:"ADD", NumpadSubtract:"Subtract",
    Comma:"Comma", Period:"Period", Slash:"Slash", Backslash:"Backslash",
    Semicolon:"Semicolon", Quote:"Quote", Backquote:"Tilde",
    BracketLeft:"LeftBracket", BracketRight:"RightBracket",
    ContextMenu:"GlobalMenu",
  };
  const DIGIT2KEY = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];

  function keyName(e){                 // KeyboardEvent -> UE 键名
    const c = e.code || "";
    if(CODE2KEY[c]) return CODE2KEY[c];
    let m;
    if((m = c.match(/^Key([A-Z])$/)))  return m[1];
    if((m = c.match(/^Digit(\d)$/)))   return DIGIT2KEY[+m[1]] || null;
    if((m = c.match(/^Numpad(\d)$/)))  return "NumPad" + m[1];
    if(/^F([1-9]|1[0-2])$/.test(c))    return c;
    return c || null;
  }
  function mouseName(e){               // MouseEvent -> UE 键名
    return {0:"LeftMouseButton",1:"MiddleMouseButton",2:"RightMouseButton",
            3:"ThumbMouseButton",4:"ThumbMouseButton2"}[e.button] || null;
  }
  function wheelName(e){ return e.deltaY < 0 ? "MouseScrollUp" : "MouseScrollDown"; }

  const DISP = {
    SpaceBar:"空格", LeftShift:"左Shift", RightShift:"右Shift",
    LeftControl:"左Ctrl", RightControl:"右Ctrl", LeftAlt:"左Alt", RightAlt:"右Alt",
    CapsLock:"CapsLock", Tab:"Tab", Escape:"ESC", Enter:"回车", Backspace:"退格",
    LeftMouseButton:"鼠标左键", RightMouseButton:"鼠标右键", MiddleMouseButton:"鼠标中键",
    ThumbMouseButton:"鼠标侧键1", ThumbMouseButton2:"鼠标侧键2",
    MouseScrollUp:"滚轮上", MouseScrollDown:"滚轮下",
    Up:"↑", Down:"↓", Left:"←", Right:"→", Equals:"=", ADD:"+", Minus:"-",
    Subtract:"-", GlobalMenu:"菜单键", Tilde:"`", LeftBracket:"[", RightBracket:"]",
    Semicolon:";", Quote:"'", Comma:",", Period:".", Slash:"/", Backslash:"\\",
  };
  function dispName(k){ return k ? (DISP[k] || k) : "—"; }

  /* ---------- 绑定存取 ---------- */
  let map = {};
  function load(){
    map = {};
    let saved = null;
    try{ saved = JSON.parse(localStorage.getItem(LS_KEY)||"null"); }catch(e){}
    ACTIONS.forEach(a=>{ map[a.id] = (saved && a.id in saved) ? saved[a.id] : a.def; });
  }
  function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(map)); }catch(e){} }
  function conflicts(){                 // 返回出现重复的键名集合
    const seen = {}, dup = {};
    ACTIONS.forEach(a=>{ const k = map[a.id]; if(!k) return;
      if(seen[k]) dup[k] = true; else seen[k] = true; });
    return dup;
  }
  function setBind(id, key){
    map[id] = key; save();
    if(typeof KB.onChange === "function") KB.onChange();
  }

  /* ---------- 按键状态（供靶场轮询） ---------- */
  const held = new Set();
  let listening = false;
  window.addEventListener("keydown", e=>{ if(!listening) held.add(keyName(e)); }, true);
  window.addEventListener("keyup",   e=>{ held.delete(keyName(e)); }, true);
  window.addEventListener("mousedown", e=>{
    // 仅追踪画布上的鼠标按下（指针锁定后所有鼠标事件都落在画布上），
    // 避免 UI 按钮点击污染按键状态
    if(!listening && e.target && e.target.tagName === "CANVAS") held.add(mouseName(e));
  }, true);
  window.addEventListener("mouseup",   e=>{ held.delete(mouseName(e)); }, true);
  window.addEventListener("blur", ()=>held.clear());

  const KB = {
    ACTIONS, CATS,
    keyName, mouseName, wheelName, dispName,
    get: id => map[id] !== undefined ? map[id] : (ACTION_BY_ID[id] ? ACTION_BY_ID[id].def : null),
    down: id => { const k = map[id]; return !!k && held.has(k); },
    eq: (a,b) => !!a && !!b && a === b,
    label: id => dispName(KB.get(id)),
    reset(id){ setBind(id, ACTION_BY_ID[id].def); },
    resetAll(){ ACTIONS.forEach(a=>map[a.id]=a.def); save();
      if(typeof KB.onChange === "function") KB.onChange(); render(); },
    onChange: null,
  };
  load();

  /* ================= 独立键位设置界面 ================= */
  let curCat = "move";

  function esc(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

  function render(){
    const nav = document.getElementById("kb-side");
    if(!nav) return;
    nav.querySelectorAll(".kb-nav").forEach(el=>
      el.classList.toggle("on", el.dataset.cat === curCat));
    const cat = CATS.find(c=>c.id===curCat);
    document.getElementById("kb-cat-title").textContent = cat.name + "键位";
    const dup = conflicts();
    const rows = ACTIONS.filter(a=>a.cat===curCat).map(a=>{
      const k = map[a.id];
      const conf = k && dup[k];
      return `<div class="kbrow ${conf?'conflict':''}" data-id="${a.id}">
        <span class="kn">${esc(a.name)}</span>
        ${a.rng?'<span class="ktag" title="靶场复刻中实际生效">靶场</span>':''}
        ${conf?`<span class="kcf">按键冲突</span>`:''}
        <span class="ksrc">${esc(a.def===k?"游戏默认":"已修改")}</span>
        <span class="kk" data-k="${esc(k||"")}">${esc(dispName(k))}</span>
      </div>`;
    }).join("");
    document.getElementById("kb-rows").innerHTML = rows;
    document.getElementById("kb-rows").querySelectorAll(".kbrow").forEach(row=>{
      row.querySelector(".kk").onclick = e=>{ e.stopPropagation(); startListen(row.dataset.id); };
    });
  }

  function startListen(id){
    if(listening) return;
    const row = document.querySelector(`.kbrow[data-id="${id}"]`);
    if(!row) return;
    listening = true;
    row.classList.add("listen");
    const kk = row.querySelector(".kk");
    kk.textContent = "按下新按键…";

    function cleanup(){
      listening = false;
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("wheel", onWheel, {capture:true, passive:false});
      render();
    }
    function finish(key){
      if(key === "Escape"){ cleanup(); return; }        // ESC 取消
      if(key === "Backspace" || key === "Delete"){ setBind(id, null); cleanup(); return; }
      setBind(id, key); cleanup();
    }
    function onKey(e){
      e.preventDefault(); e.stopPropagation();
      finish(keyName(e) || "Escape");
    }
    function onMouse(e){
      e.preventDefault(); e.stopPropagation();
      finish(mouseName(e) || "Escape");
    }
    function onWheel(e){
      e.preventDefault(); e.stopPropagation();
      finish(wheelName(e));
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    window.addEventListener("wheel", onWheel, {capture:true, passive:false});
  }

  function initUI(){
    const nav = document.getElementById("kb-side");
    if(!nav) return;
    nav.querySelectorAll(".kb-nav").forEach(el=>el.onclick = ()=>{ curCat = el.dataset.cat; render(); });
    document.getElementById("kb-reset-cat").onclick = ()=>{
      ACTIONS.filter(a=>a.cat===curCat).forEach(a=>map[a.id]=a.def);
      save(); if(typeof KB.onChange === "function") KB.onChange(); render();
    };
    document.getElementById("kb-reset-all").onclick = ()=>KB.resetAll();
    render();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", initUI);
  else initUI();

  return KB;
})();
