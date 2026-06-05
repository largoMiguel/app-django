/**
 * SoftOne — Launcher del chat IA del PDM para sitios gov.co
 *
 * Uso:
 * <script src="https://app.softone360.com/embed/pdm-chat.js" data-entity="slug-entidad"></script>
 *
 * Opciones (data-*):
 *   data-entity   — slug de la entidad (requerido)
 *   data-base     — URL base (default: origen del script)
 *   data-position — bottom-right | bottom-left (default: bottom-right)
 *   data-color    — color del botón (default: #3eafd4)
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var entity = script.getAttribute("data-entity");
  if (!entity) {
    console.warn("[SoftOne PDM Chat] Falta data-entity en el script.");
    return;
  }

  var base = script.getAttribute("data-base");
  if (!base) {
    var src = script.src || "";
    var match = src.match(/^(https?:\/\/[^/]+)/);
    base = match ? match[1] : window.location.origin;
  }

  var position = script.getAttribute("data-position") || "bottom-right";
  var color = script.getAttribute("data-color") || "#3eafd4";
  var chatUrl = base + "/chat/" + encodeURIComponent(entity) + "?embed=1";

  var isOpen = false;
  var panel = null;
  var iframe = null;
  var btn = null;

  var styles = document.createElement("style");
  styles.textContent = [
    "#softone-pdm-chat-btn{position:fixed;z-index:99998;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;font-size:24px;color:#fff;}",
    "#softone-pdm-chat-btn:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(0,0,0,.25);}",
    "#softone-pdm-chat-panel{position:fixed;z-index:99999;width:400px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 100px);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.18);display:none;flex-direction:column;background:#fff;}",
    "#softone-pdm-chat-panel.open{display:flex;}",
    "#softone-pdm-chat-panel iframe{flex:1;border:none;width:100%;}",
    "#softone-pdm-chat-close{position:absolute;top:8px;right:8px;z-index:1;width:28px;height:28px;border-radius:50%;border:none;background:rgba(0,0,0,.4);color:#fff;cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;}",
    position === "bottom-left"
      ? "#softone-pdm-chat-btn,#softone-pdm-chat-panel{bottom:24px;left:24px;}"
      : "#softone-pdm-chat-btn,#softone-pdm-chat-panel{bottom:24px;right:24px;}",
  ].join("");
  document.head.appendChild(styles);

  btn = document.createElement("button");
  btn.id = "softone-pdm-chat-btn";
  btn.style.background = color;
  btn.setAttribute("aria-label", "Abrir chat del PDM");
  btn.innerHTML = "💬";
  btn.addEventListener("click", toggle);

  panel = document.createElement("div");
  panel.id = "softone-pdm-chat-panel";

  var closeBtn = document.createElement("button");
  closeBtn.id = "softone-pdm-chat-close";
  closeBtn.innerHTML = "✕";
  closeBtn.setAttribute("aria-label", "Cerrar chat");
  closeBtn.addEventListener("click", close);

  iframe = document.createElement("iframe");
  iframe.title = "Chat IA del PDM";
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("allow", "clipboard-write");

  panel.appendChild(closeBtn);
  panel.appendChild(iframe);
  document.body.appendChild(panel);
  document.body.appendChild(btn);

  function open() {
    if (!iframe.src) iframe.src = chatUrl;
    panel.classList.add("open");
    btn.style.display = "none";
    isOpen = true;
  }

  function close() {
    panel.classList.remove("open");
    btn.style.display = "flex";
    isOpen = false;
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }
})();
