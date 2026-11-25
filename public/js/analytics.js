/**
 * Liar's Cards – Analytics & GA4 Event Tracking
 *
 * Replace GA_MEASUREMENT_ID with your actual GA4 Measurement ID (e.g. G-XXXXXXXXXX)
 * before deploying.
 *
 * Events tracked:
 *   play_button_click   – user clicks With Friends / With Randoms / With AI
 *   room_created        – socket callback confirms room creation
 *   room_joined         – socket callback confirms room join
 *   game_started        – gameStarted socket event (redirect to game.html)
 *   invite_link_copied  – user clicks Copy Link in lobby
 *
 * This file is intentionally lightweight and sends NO personally identifying
 * information and NO in-game card or session state data.
 */

(function () {
  'use strict';

  // ── Helper: fire GA4 event safely ──────────────────────────────────────────
  function gEvent(name, params) {
    if (typeof window.gtag !== 'function') return;
    try {
      window.gtag('event', name, params || {});
    } catch (e) {
      // silent – never break gameplay
    }
  }

  // ── Expose globally so individual pages can call gEvent ───────────────────
  window.lcAnalytics = { event: gEvent };

  // ── Homepage events ────────────────────────────────────────────────────────
  var page = window.location.pathname;
  if (page === '/' || page === '/index.html') {

    function trackClick(id, eventName, label) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function () {
        gEvent(eventName, { game_mode: label });
      });
    }

    // Delay slightly to allow DOM ready on deferred scripts
    document.addEventListener('DOMContentLoaded', function () {
      trackClick('btn-friends', 'play_button_click', 'friends');
      trackClick('btn-randoms', 'play_button_click', 'randoms');
      trackClick('btn-ai',      'play_button_click', 'ai');
    });
  }

})();
