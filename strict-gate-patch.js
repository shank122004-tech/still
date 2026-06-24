/**
 * strict-gate-patch.js — CrackAI Hard Paywall v1.3
 * Loads last (defer). Overrides all canSend*, model gates,
 * teacher gate, premium gates. 0 free chats, 3 free battles/day.
 */
(function () {
  'use strict';

  var FREE_TEXT  = 0;      // 0 free chats (require premium)
  var FREE_IMAGE = 0;
  var FREE_PDF   = 0;
  var FREE_BATTLES = 3;    // 3 free battles per day

  /* ── Safe isPremium check ─────────────────────────────────── */
  function isPremium() {
    try {
      var uid = window._firebaseAuth && window._firebaseAuth.currentUser
                  ? window._firebaseAuth.currentUser.uid : null;
      var p = uid ? ('sscai_u:' + uid + ':') : 'sscai_guest:';
      if (localStorage.getItem(p + 'premium') === 'true') {
        if (typeof state !== 'undefined') state.isPremium = true;
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  /* ── Open premium modal safely ────────────────────────────── */
  function openPremium() {
    try {
      if (typeof openPremiumModal === 'function') { openPremiumModal(); return; }
      if (typeof window.showPremiumModal === 'function') { window.showPremiumModal(); return; }
      var m = document.getElementById('premiumModal');
      if (m) m.classList.add('active');
    } catch (e) {}
  }

  /* ── Disable reward / ad bypass ──────────────────────────── */
  window.isRewardActive      = function () { return false; };
  window.rewardRemainingMs   = function () { return 0; };
  window.rewardRemainingLabel= function () { return '0:00'; };
  window.showRewardPopup     = function () { openPremium(); };
  window.activateReward      = function () {};

  /* ── canSend* functions (0 free = all require premium) ───────── */
  function canText()  {
    if (isPremium()) return true;
    return false;  // 0 free
  }
  function canImage() {
    if (isPremium()) return true;
    return false;  // 0 free
  }
  function canPdf()   {
    if (isPremium()) return true;
    return false;  // 0 free
  }

  window.canSendText  = canText;
  window.canSendImage = canImage;
  window.canSendPdf   = canPdf;

  /* ── handleLimitHit → always open premium modal ─────────── */
  window.handleLimitHit = function (type) {
    var labels = { text: 'AI Chats require Premium (0 free)', image: 'Image chat requires Premium', pdf: 'PDF chat requires Premium' };
    try { if (typeof showToast === 'function') showToast('🔒 ' + (labels[type] || 'Upgrade Required') + ' — Start from ₹129/month'); } catch(e){}
    openPremium();
  };

  /* ── Patch sendMessage ────────────────────────────────────── */
  function patchSendMessage() {
    var _orig = window.sendMessage;
    if (typeof _orig !== 'function') { setTimeout(patchSendMessage, 150); return; }
    if (_orig._sgPatched) return;
    function patched() {
      try {
        var hasImages = typeof pendingImageFiles !== 'undefined' && pendingImageFiles.length > 0;
        var hasPdf    = typeof pendingPdfFile    !== 'undefined' && !!pendingPdfFile;
        if (hasImages && !canImage()) { window.handleLimitHit('image'); return; }
        if (hasPdf    && !canPdf())   { window.handleLimitHit('pdf');   return; }
        if (!canText())               { window.handleLimitHit('text');  return; }
      } catch(e) {}
      return _orig.apply(this, arguments);
    }
    patched._sgPatched = true;
    window.sendMessage = patched;
  }
  patchSendMessage();

  /* ── Battle access gate (3 per day free) ─────────────────── */
  window.checkBattleAccess = function() {
    if (isPremium()) return true;
    try {
      var today = new Date().toISOString().split('T')[0];
      var key = 'sscai_battles_' + today;
      var count = parseInt(localStorage.getItem(key) || '0');
      if (count >= FREE_BATTLES) {
        if (typeof showToast === 'function') showToast('🔒 Daily battle limit reached (3/day). Upgrade for unlimited');
        openPremium();
        return false;
      }
      return true;
    } catch(e) { return false; }
  };

  /* ── Model selection gate ─────────────────────────────────── */
  var GATED_MODELS = ['pro', 'vision-pro', 'v4-pro'];

  document.addEventListener('click', function (e) {
    try {
      var opt = e.target.closest && e.target.closest('.model-option[data-model]');
      if (!opt) return;
      var model = opt.dataset.model;
      if (GATED_MODELS.indexOf(model) === -1) return;
      if (isPremium()) return;
      e.stopImmediatePropagation();
      try { if (typeof showToast === 'function') showToast('🔒 ' + model + ' requires Premium'); } catch(ex){}
      openPremium();
      document.querySelectorAll('.model-selector-dropdown').forEach(function(d){ d.classList.remove('open'); });
    } catch(e) {}
  }, true);

  /* ── Teacher / Voice-AI gate ─────────────────────────────── */
  function restoreTeacherGate() {
    try {
      window.__teacherAlwaysFree = false;
      if (!isPremium()) localStorage.removeItem('sscai_teacher_unlocked');
      window.openTeacherPaywall = function () {
        try { if (typeof showToast === 'function') showToast('🔒 Teacher Mode requires Premium'); } catch(ex){}
        openPremium();
      };
    } catch(e) {}
  }
  restoreTeacherGate();
  setTimeout(restoreTeacherGate, 500);
  setTimeout(restoreTeacherGate, 2500);
  window.addEventListener('load', restoreTeacherGate);

  /* ── Upload button gates ─────────────────────────────────── */
  function patchUploadBtns() {
    function gateBtn(id, limitFn, type) {
      var btn = document.getElementById(id);
      if (!btn || btn._sgBound) return;
      btn._sgBound = true;
      btn.addEventListener('click', function (e) {
        if (!limitFn()) {
          e.stopImmediatePropagation();
          try {
            var sub  = document.getElementById('uploadSubMenu');
            var wrap = document.getElementById('uploadBtnWrap');
            if (sub)  sub.style.display = 'none';
            if (wrap) wrap.classList.remove('open');
          } catch(ex){}
          window.handleLimitHit(type);
        }
      }, true);
    }
    gateBtn('imageUploadBtn', canImage, 'image');
    gateBtn('pdfUploadBtn',   canPdf,   'pdf');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchUploadBtns);
  } else {
    patchUploadBtns();
  }
  setTimeout(patchUploadBtns, 800);
  setTimeout(patchUploadBtns, 2500);

  /* ── Limit UI text ───────────────────────────────────────── */
  var _origUpdateLimitUI = window.updateLimitUI;
  window.updateLimitUI = function () {
    try { if (typeof _origUpdateLimitUI === 'function') _origUpdateLimitUI(); } catch(e){}
    try {
      var el = document.getElementById('messageLimitInfo');
      if (!el || isPremium()) return;
      el.innerHTML = '<span style="color:#ef4444;font-size:11px;">🔒 AI Chats require Premium (₹129–1699/mo) · <a href="#" onclick="openPremiumModal&&openPremiumModal();return false;" style="color:#f59e0b;text-decoration:none;font-weight:600;">Upgrade ⭐</a></span>';
    } catch(e) {}
  };

  /* ── Periodic re-enforcement every 10s ──*/
  let _lastGatePremiumState = null;
  setInterval(function () {
    if (document.visibilityState === 'hidden') return;
    var prem = isPremium();
    if (window.canSendText  !== canText)  window.canSendText  = canText;
    if (window.canSendImage !== canImage) window.canSendImage = canImage;
    if (window.canSendPdf   !== canPdf)   window.canSendPdf   = canPdf;
    window.isRewardActive = function () { return false; };
    if (!prem && localStorage.getItem('sscai_teacher_unlocked') === 'true') {
      localStorage.removeItem('sscai_teacher_unlocked');
    }
    if (prem !== _lastGatePremiumState) {
      _lastGatePremiumState = prem;
      if (prem && typeof updateLimitUI === 'function') updateLimitUI();
    }
  }, 10000);

  console.info('[StrictGate] v1.3 — 0 free chats, 3 free battles/day, premium from ₹129');

})();

/* ── Premium check for Mock Test ── */
(function patchCFMockTest() {
  function robustIsPremium() {
    try {
      var uid = window._firebaseAuth && window._firebaseAuth.currentUser
                  ? window._firebaseAuth.currentUser.uid : null;
      if (uid && localStorage.getItem('sscai_u:' + uid + ':premium') === 'true') return true;
      if (localStorage.getItem('sscai_u:guest:premium') === 'true') return true;
      if (typeof state !== 'undefined' && state.isPremium) return true;
      return false;
    } catch (e) { return false; }
  }

  function patch() {
    if (!window.CF || typeof window.CF.openModal !== 'function') {
      setTimeout(patch, 200);
      return;
    }
    window.CF.openMockTest = function () {
      if (!robustIsPremium()) {
        try { if (typeof showToast === 'function') showToast('🔒 Mock Test requires Premium (₹129+/mo)'); } catch(e){}
        try { if (typeof openPremiumModal === 'function') openPremiumModal(); } catch(e){}
        return;
      }
      window.CF.openModal('cf-mock-modal');
      window.CF._renderMockTest();
    };
    console.info('[StrictGate] Mock Test gated to premium');
  }
  patch();
})();