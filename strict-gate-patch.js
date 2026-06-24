/**
 * strict-gate-patch.js — CrackAI Hard Paywall v1.4
 * 0 free chats, 3 free mock tests/day, 3 free battles/day
 * Backend premium verification from https://verifypayment-56khnynjia-uc.a.run.app
 */
(function () {
  'use strict';

  var FREE_TEXT  = 0;
  var FREE_IMAGE = 0;
  var FREE_PDF   = 0;
  var FREE_BATTLES = 3;
  var FREE_MOCK_TESTS = 3;

  /* ── Backend premium verification ─────────────────────────── */
  window._premiumCache = { uid: null, status: null, lastCheck: 0, cacheDuration: 600000 };
  
  async function verifyPremiumBackend(uid) {
    const now = Date.now();
    if (window._premiumCache.uid === uid && (now - window._premiumCache.lastCheck) < window._premiumCache.cacheDuration) {
      return window._premiumCache.status;
    }
    try {
      const response = await fetch('https://verifypayment-56khnynjia-uc.a.run.app/verify?uid=' + uid);
      const data = await response.json();
      const isPrem = data.premium || data.isPremium || false;
      window._premiumCache.uid = uid;
      window._premiumCache.status = isPrem;
      window._premiumCache.lastCheck = now;
      localStorage.setItem('sscai_u:' + uid + ':premium', isPrem ? 'true' : 'false');
      return isPrem;
    } catch(e) {
      return localStorage.getItem('sscai_u:' + uid + ':premium') === 'true';
    }
  }

  /* ── Safe isPremium check ─────────────────────────────────── */
  async function isPremium() {
    try {
      var uid = window._firebaseAuth && window._firebaseAuth.currentUser
                  ? window._firebaseAuth.currentUser.uid : null;
      if (!uid) return false;
      
      const backendStatus = await verifyPremiumBackend(uid);
      if (backendStatus) {
        localStorage.setItem('sscai_u:' + uid + ':premium', 'true');
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

  /* ── canSend* functions (0 free) ───────────────────────────── */
  function canText()  { return false; }
  function canImage() { return false; }
  function canPdf()   { return false; }

  window.canSendText  = canText;
  window.canSendImage = canImage;
  window.canSendPdf   = canPdf;

  /* ── handleLimitHit ──────────────────────────────────────── */
  window.handleLimitHit = function (type) {
    var labels = { text: 'AI Chats require Premium (0 free)', image: 'Image chat requires Premium', pdf: 'PDF chat requires Premium' };
    try { if (typeof showToast === 'function') showToast('🔒 ' + (labels[type] || 'Upgrade Required') + ' — Start from ₹129/month'); } catch(e){}
    openPremium();
  };

  /* ── Mock Test limit (3 per day free) ────────────────────── */
  window.checkMockTestAccess = async function() {
    const uid = (typeof window._firebaseAuth !== 'undefined' && window._firebaseAuth.currentUser) ? window._firebaseAuth.currentUser.uid : 'guest';
    const isPrem = await isPremium();
    
    if (isPrem) return { allowed: true, reason: 'Premium user' };
    
    const today = new Date().toISOString().split('T')[0];
    const key = 'sscai_mock_' + today;
    const count = parseInt(localStorage.getItem(key) || '0');
    
    if (count >= FREE_MOCK_TESTS) {
      return { allowed: false, reason: '🔒 Daily mock test limit reached (3/day). Upgrade for unlimited.', limit: 3, used: count };
    }
    
    return { allowed: true, used: count, limit: 3 };
  };

  /* ── Track mock test usage ──────────────────────────────── */
  window.trackMockTestUsage = function() {
    const uid = (typeof window._firebaseAuth !== 'undefined' && window._firebaseAuth.currentUser) ? window._firebaseAuth.currentUser.uid : 'guest';
    const isPrem = localStorage.getItem('sscai_u:' + uid + ':premium') === 'true';
    
    if (!isPrem) {
      const today = new Date().toISOString().split('T')[0];
      const key = 'sscai_mock_' + today;
      const count = parseInt(localStorage.getItem(key) || '0');
      localStorage.setItem(key, (count + 1).toString());
    }
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
    const isPrem = localStorage.getItem('sscai_u:' + ((typeof uid === 'function') ? uid() : 'guest') + ':premium') === 'true';
    if (isPrem) return true;
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
      const isPrem = localStorage.getItem('sscai_u:' + ((typeof uid === 'function') ? uid() : 'guest') + ':premium') === 'true';
      if (isPrem) return;
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
      const isPrem = localStorage.getItem('sscai_u:' + ((typeof uid === 'function') ? uid() : 'guest') + ':premium') === 'true';
      if (!isPrem) localStorage.removeItem('sscai_teacher_unlocked');
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
      if (!el) return;
      const isPrem = localStorage.getItem('sscai_u:' + ((typeof uid === 'function') ? uid() : 'guest') + ':premium') === 'true';
      if (isPrem) return;
      el.innerHTML = '<span style="color:#ef4444;font-size:11px;">🔒 AI Chats require Premium (₹129–1699/mo) · <a href="#" onclick="openPremiumModal&&openPremiumModal();return false;" style="color:#f59e0b;text-decoration:none;font-weight:600;">Upgrade ⭐</a></span>';
    } catch(e) {}
  };

  /* ── Periodic re-enforcement ──*/
  let _lastGatePremiumState = null;
  setInterval(function () {
    if (document.visibilityState === 'hidden') return;
    const uid = (typeof window._firebaseAuth !== 'undefined' && window._firebaseAuth.currentUser) ? window._firebaseAuth.currentUser.uid : null;
    if (uid) verifyPremiumBackend(uid).catch(() => {});
    
    if (window.canSendText  !== canText)  window.canSendText  = canText;
    if (window.canSendImage !== canImage) window.canSendImage = canImage;
    if (window.canSendPdf   !== canPdf)   window.canSendPdf   = canPdf;
    window.isRewardActive = function () { return false; };
  }, 10000);

  console.info('[StrictGate] v1.4 — 0 free chats, 3 free mock tests/day, 3 free battles/day, backend verification enabled');

})();

/* ── Premium check for Mock Test ── */
(function patchCFMockTest() {
  function patch() {
    if (!window.CF || typeof window.CF.openModal !== 'function') {
      setTimeout(patch, 200);
      return;
    }
    const _orig = window.CF.openMockTest;
    window.CF.openMockTest = async function () {
      const access = await window.checkMockTestAccess();
      if (!access.allowed) {
        try { if (typeof showToast === 'function') showToast(access.reason); } catch(e){}
        try { if (typeof openPremiumModal === 'function') openPremiumModal(); } catch(e){}
        return;
      }
      window.trackMockTestUsage();
      if (typeof _orig === 'function') return _orig.call(this);
      window.CF.openModal('cf-mock-modal');
      if (typeof window.CF._renderMockTest === 'function') window.CF._renderMockTest();
    };
    console.info('[StrictGate] Mock Test gated to 3/day + premium');
  }
  patch();
})();
