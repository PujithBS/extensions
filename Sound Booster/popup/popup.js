document.addEventListener('DOMContentLoaded', function () {
    const els = {
        vol: document.getElementById('volumeSlider'),
        volDisplay: document.getElementById('volumeValue'),
        bass: document.getElementById('bass'),
        mid: document.getElementById('mid'),
        treble: document.getElementById('treble'),
        lowpass: document.getElementById('lowpass'),
        highpass: document.getElementById('highpass'),
        echo: document.getElementById('echo'),
        dist: document.getElementById('distortion'),
        speed: document.getElementById('speed'),
        speedVal: document.getElementById('speedVal'),
        vibe: document.getElementById('vibeToggle'),
        fx: document.getElementById('fxToggle'),
        title: document.getElementById('mediaTitle'),
        reset: document.getElementById('resetBtn'),
        presets: document.querySelectorAll('.preset-btn')
    };

    const defaults = {
        lastVolume: 100,
        bass: 0, mid: 0, treble: 0,
        lowpass: 22050, highpass: 0,
        echo: 0, distortion: 0, speed: 1,
        vibeMode: false, fxMode: false
    };

    const presetConfig = {
        bass: { bass: 15, mid: 5, treble: 0 },
        movie: { bass: 10, mid: -5, treble: 5, echo: 0.1 },
        vocal: { bass: -5, mid: 10, treble: 5 },
        flat: { bass: 0, mid: 0, treble: 0, echo: 0, distortion: 0 }
    };

    const safeListen = (el, evt, handler) => { if (el) el.addEventListener(evt, handler); };
    const save = (key, val) => chrome.storage.local.set({ [key]: val });

    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(Object.keys(defaults).concat(['currentTrack']), (result) => {
            updateUI(result);
            if (result.currentTrack && els.title) els.title.textContent = result.currentTrack;
        });
    }

    function updateUI(data) {
        if (data.lastVolume !== undefined) {
            els.vol.value = data.lastVolume;
            if (els.volDisplay) els.volDisplay.textContent = data.lastVolume + '%';
        }
        if (data.bass !== undefined) els.bass.value = data.bass;
        if (data.mid !== undefined) els.mid.value = data.mid;
        if (data.treble !== undefined) els.treble.value = data.treble;
        if (data.lowpass !== undefined) els.lowpass.value = data.lowpass;
        if (data.highpass !== undefined) els.highpass.value = data.highpass;
        if (data.echo !== undefined) els.echo.value = data.echo;
        if (data.distortion !== undefined) els.dist.value = data.distortion;
        if (data.speed !== undefined) {
            els.speed.value = data.speed;
            if (els.speedVal) els.speedVal.textContent = data.speed + 'x';
        }
        if (data.vibeMode !== undefined) els.vibe.checked = data.vibeMode;
        if (data.fxMode !== undefined) els.fx.checked = data.fxMode;
    }

    safeListen(els.vol, 'input', function () {
        els.volDisplay.textContent = this.value + '%';
        save('lastVolume', parseInt(this.value));
    });

    ['bass', 'mid', 'treble'].forEach(id => safeListen(els[id], 'input', function () { save(id, parseFloat(this.value)); }));
    safeListen(els.lowpass, 'input', function () { save('lowpass', parseFloat(this.value)); });
    safeListen(els.highpass, 'input', function () { save('highpass', parseFloat(this.value)); });
    safeListen(els.echo, 'input', function () { save('echo', parseFloat(this.value)); });
    safeListen(els.dist, 'input', function () { save('distortion', parseFloat(this.value)); });

    safeListen(els.speed, 'input', function () {
        els.speedVal.textContent = this.value + 'x';
        save('speed', parseFloat(this.value));
    });

    safeListen(els.vibe, 'change', function () { save('vibeMode', this.checked); });
    safeListen(els.fx, 'change', function () { save('fxMode', this.checked); });

    if (els.presets) {
        els.presets.forEach(btn => {
            btn.addEventListener('click', () => {
                const p = presetConfig[btn.dataset.preset];
                if (p) chrome.storage.local.set(p, () => { chrome.storage.local.get(null, (res) => updateUI(res)); });
            });
        });
    }

    safeListen(els.reset, 'click', function () {
        chrome.storage.local.set(defaults, () => updateUI(defaults));
    });
});