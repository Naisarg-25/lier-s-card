(function () {
  const adFormats = {
    wide: {
      key: 'a2beb4e3fe796e82f4e5dc8da5a1d823',
      width: 728,
      height: 90
    },
    banner: {
      key: '23aa66b0e2bc57e1722f63448dce4abb',
      width: 320,
      height: 50
    },
    rectangle: {
      key: '25b9403ffa7d52d13c40607b2e06be07',
      width: 300,
      height: 250
    }
  };

  function selectAdFormat(slot) {
    if (slot.dataset.adSize === 'winner') {
      const isMobileDevice = navigator.userAgentData?.mobile
        || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      return (isMobileDevice || window.matchMedia('(max-width: 767px)').matches)
        ? adFormats.rectangle
        : adFormats.wide;
    }

    if (slot.dataset.adSize === 'compact') return adFormats.rectangle;
    const availableWidth = slot.parentElement?.clientWidth || window.innerWidth;
    if (availableWidth >= 768) return adFormats.wide;
    if (availableWidth >= 480) return adFormats.rectangle;
    if (availableWidth >= 320) return adFormats.banner;
    return adFormats.rectangle;
  }

  function loadResponsiveAd(slot) {
    if (!slot || slot.dataset.adLoaded === 'true') return;

    const format = selectAdFormat(slot);
    const unit = document.createElement('div');
    const script = document.createElement('script');

    slot.dataset.adLoaded = 'true';
    unit.className = `ad-unit ad-unit-${format.width}`;
    window.atOptions = {
      key: format.key,
      format: 'iframe',
      height: format.height,
      width: format.width,
      params: {}
    };

    script.src = `https://bauval.org/22/${format.key}`;
    script.async = false;
    script.addEventListener('error', () => {
      console.error('[Ads] Failed to load advertisement script:', script.src);
    });
    unit.appendChild(script);
    slot.appendChild(unit);
  }

  window.loadResponsiveAd = loadResponsiveAd;
  document.querySelectorAll('[data-ad-auto]').forEach(loadResponsiveAd);
})();
