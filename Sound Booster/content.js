(function () {
    if (window.hasRunSoundBooster) return;
    window.hasRunSoundBooster = true;

    let audioCtx, gainNode, bass, mid, treble, distortion, delay, feedback, lowpass, highpass, dryMix, wetMix, analyser;
    let canvas, ctx, dataArray, bufferLength, animationId;
    const connectedElements = new WeakSet();
    let boostTimer = null;

    let settings = {
        volume: 100, bass: 0, mid: 0, treble: 0,
        lowpass: 22050, highpass: 0, echo: 0, distortion: 0,
        speed: 1, vibeMode: false, fxMode: false
    };

    function handleYouTube() {
        if (!window.location.hostname.includes('youtube.com')) return;

        const video = document.querySelector('video');
        if (video && video.paused) {
            const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
            const popup = document.querySelector('ytd-popup-container') || document.querySelector('[role="dialog"]');

            if (backdrop || (popup && popup.children.length > 0)) {
                const buttons = document.querySelectorAll('#dismiss-button, .yt-spec-button-shape-next--filled, button[aria-label="Dismiss"]');
                if (buttons.length > 0) {
                    buttons.forEach(btn => btn.click());
                } else {
                    if (popup) popup.remove();
                    if (backdrop) backdrop.remove();
                }
                video.play();
            }
        }

        const adShowing = document.querySelector('.ad-showing') || document.querySelector('.video-ads.ytp-ad-module');
        if (adShowing && adShowing.children.length > 0 && video) {
            video.muted = true;
            video.playbackRate = 16.0;
            if (isFinite(video.duration)) video.currentTime = video.duration;

            const skipBtns = document.querySelectorAll('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern');
            skipBtns.forEach(btn => btn.click());

            document.querySelectorAll('.ytd-banner-promo-renderer, .ytd-video-masthead-ad-v3-renderer').forEach(b => b.remove());
        }
    }

    function initAudioContext() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();

            gainNode = audioCtx.createGain();

            bass = audioCtx.createBiquadFilter();
            bass.type = 'lowshelf';
            bass.frequency.value = 100;

            mid = audioCtx.createBiquadFilter();
            mid.type = 'peaking';
            mid.frequency.value = 1000;
            mid.Q.value = 1.0;

            treble = audioCtx.createBiquadFilter();
            treble.type = 'highshelf';
            treble.frequency.value = 8000;

            distortion = audioCtx.createWaveShaper();
            delay = audioCtx.createDelay();
            feedback = audioCtx.createGain();
            lowpass = audioCtx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 22050;
            highpass = audioCtx.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 0;

            dryMix = audioCtx.createGain(); dryMix.gain.value = 1;
            wetMix = audioCtx.createGain(); wetMix.gain.value = 0;
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);

            gainNode.connect(bass);
            bass.connect(mid); mid.connect(treble); treble.connect(distortion);

            distortion.connect(dryMix);
            distortion.connect(delay); delay.connect(wetMix);
            delay.connect(feedback); feedback.connect(delay);

            dryMix.connect(lowpass); wetMix.connect(lowpass);
            lowpass.connect(highpass); highpass.connect(analyser);
            analyser.connect(audioCtx.destination);

            createCanvas();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => { });
    }

    function makeDistortionCurve(amount) {
        if (amount <= 0) return null;
        const k = amount; const n = 44100; const curve = new Float32Array(n); const deg = Math.PI / 180;
        for (let i = 0; i < n; ++i) {
            const x = (i * 2) / n - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    function applySettings() {
        if (!audioCtx) return;

        gainNode.gain.value = settings.volume / 100;
        bass.gain.value = settings.bass;
        mid.gain.value = settings.mid;
        treble.gain.value = settings.treble;
        lowpass.frequency.value = settings.lowpass;
        highpass.frequency.value = settings.highpass;
        delay.delayTime.value = settings.echo;
        feedback.gain.value = settings.echo > 0 ? 0.3 : 0;
        wetMix.gain.value = settings.echo > 0 ? 0.4 : 0;
        dryMix.gain.value = settings.echo > 0 ? 0.6 : 1;
        distortion.curve = makeDistortionCurve(settings.distortion);

        const overlay = document.getElementById('sb-visualizer');
        if (settings.fxMode) {
            if (overlay) overlay.style.display = 'block';
            if (!animationId) drawEQ();
        } else {
            if (overlay) overlay.style.display = 'none';
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        toggleVibeScreen(settings.vibeMode);

        const videos = document.querySelectorAll('video');
        const isAd = window.location.hostname.includes('youtube.com') && document.querySelector('.ad-showing');
        if (!isAd) {
            videos.forEach(v => {
                if (Math.abs(v.playbackRate - settings.speed) > 0.05) {
                    v.playbackRate = settings.speed;
                }
            });
        }
    }

    function createCanvas() {
        if (document.getElementById('sb-visualizer')) return;
        canvas = document.createElement('canvas');
        canvas.id = 'sb-visualizer';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;background:transparent;display:none;';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
    }

    function drawEQ() {
        animationId = requestAnimationFrame(drawEQ);
        if (canvas.width !== window.innerWidth) canvas.width = window.innerWidth;
        if (canvas.height !== window.innerHeight) canvas.height = window.innerHeight;
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2; const cy = canvas.height / 2; const r = Math.min(cx, cy) * 0.25;
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * (r * 1.5);
            const rad = (i * 2 * Math.PI) / bufferLength;
            const xs = cx + Math.cos(rad) * r; const ys = cy + Math.sin(rad) * r;
            const xe = cx + Math.cos(rad) * (r + barHeight); const ye = cy + Math.sin(rad) * (r + barHeight);
            const hue = i * 2 + (Date.now() / 20);
            ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
            ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.shadowBlur = 10; ctx.shadowColor = `hsla(${hue}, 100%, 50%, 0.5)`;
            ctx.beginPath(); ctx.moveTo(xs, ys); ctx.lineTo(xe, ye); ctx.stroke(); ctx.shadowBlur = 0;
        }
    }

    function toggleVibeScreen(isActive) {
        let overlay = document.getElementById('sb-vibe-overlay');
        if (isActive) {
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'sb-vibe-overlay';
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483646;pointer-events:none;backdrop-filter:blur(10px) sepia(20%);background:rgba(10,10,15,0.2);transition:0.3s;';
                document.body.appendChild(overlay);
            }
        } else if (overlay) overlay.remove();
    }

    function boostElement(mediaElement) {
        if (connectedElements.has(mediaElement)) return;
        try {
            if (!mediaElement.crossOrigin) mediaElement.crossOrigin = "anonymous";
            initAudioContext();
            const source = audioCtx.createMediaElementSource(mediaElement);
            source.connect(gainNode);
            connectedElements.add(mediaElement);
            if (chrome?.storage?.local && document.title) chrome.storage.local.set({ 'currentTrack': document.title });
            applySettings();
        } catch (e) { }
    }

    function scan() {
        const media = Array.from(document.querySelectorAll('video, audio'));
        media.forEach(boostElement);
        handleYouTube();
    }

    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(null, (res) => {
            if (res.lastVolume) settings.volume = res.lastVolume;
            if (res.bass !== undefined) settings.bass = res.bass;
            if (res.mid !== undefined) settings.mid = res.mid;
            if (res.treble !== undefined) settings.treble = res.treble;
            if (res.lowpass) settings.lowpass = res.lowpass;
            if (res.highpass) settings.highpass = res.highpass;
            if (res.echo) settings.echo = res.echo;
            if (res.distortion) settings.distortion = res.distortion;
            if (res.speed) settings.speed = res.speed;
            settings.vibeMode = res.vibeMode;
            settings.fxMode = res.fxMode;
            scan();
        });

        chrome.storage.onChanged.addListener((changes) => {
            for (let key in changes) {
                if (settings.hasOwnProperty(key) || key === 'lastVolume') {
                    settings[key === 'lastVolume' ? 'volume' : key] = changes[key].newValue;
                }
            }
            applySettings();
        });
    }

    document.addEventListener('click', () => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, { capture: true });

    setInterval(handleYouTube, 500);

    const observer = new MutationObserver(() => {
        if (boostTimer) return;
        boostTimer = setTimeout(() => { scan(); boostTimer = null; }, 500);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();