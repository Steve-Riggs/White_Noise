class WhiteNoiseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._selectedSound = "";
    this._selectedSpeaker = "";
    this._selectedDuration = 30;
    this._volume = 20;
    this._playTarget = "this_device";
    this._isPlaying = false;
    this._message = "";
    this._audio = new Audio();
    this._playTimer = undefined;
  }

  setConfig(config) {
    this._config = {
      entity: "sensor.white_noise_sounds",
      title: "White Noise",
      show_title: false,
      show_current_sound: true,
      show_meta: true,
      speakers: [],
      durations: [
        { label: "15m", minutes: 15 },
        { label: "30m", minutes: 30 },
        { label: "1h", minutes: 60 },
        { label: "No timer", minutes: 0 },
      ],
      default_duration: 30,
      default_volume: 20,
      default_play_target: "this_device",
      compact_mode: false,
      allow_this_device: true,
      show_browser_mod_speakers: false,
      show_unavailable_speakers: false,
      show_volume: true,
      accent_color: "#f5a623",
      background_color: "#3b285d",
      background_opacity: 72,
      control_opacity: 92,
      ...config,
    };

    this._selectedSpeaker =
      this._config.default_speaker ||
      this._config.speaker ||
      this._config.speakers?.[0]?.entity ||
      "";
    this._selectedDuration = Number(this._config.default_duration ?? 30);
    this._volume = Number(this._config.default_volume ?? 20);
    this._playTarget =
      this._config.default_play_target === "speaker" ? "speaker" : "this_device";
    if (!this._selectedSpeaker && this._config.allow_this_device !== false) {
      this._playTarget = "this_device";
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._ensureSelections();
    this._render();
  }

  getCardSize() {
    return this._config.compact_mode ? 4 : 5;
  }

  static getConfigElement() {
    return document.createElement("white-noise-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:white-noise-card",
      entity: "sensor.white_noise_sounds",
      title: "White Noise",
      show_title: false,
      show_current_sound: true,
      show_meta: true,
      default_play_target: "this_device",
      default_duration: 30,
      default_volume: 20,
      allow_this_device: true,
      show_browser_mod_speakers: false,
      show_unavailable_speakers: false,
      compact_mode: false,
      accent_color: "#f5a623",
      background_color: "#3b285d",
      background_opacity: 72,
      control_opacity: 92,
      speakers: [],
      durations: [
        { label: "15m", minutes: 15 },
        { label: "30m", minutes: 30 },
        { label: "1h", minutes: 60 },
        { label: "No timer", minutes: 0 },
      ],
    };
  }

  _ensureSelections() {
    const sounds = this._getSounds();
    if (!this._selectedSound && sounds.length > 0) {
      this._selectedSound = this._config.default_sound || sounds[0].id;
    }
  }

  _getSounds() {
    return this._hass?.states?.[this._config.entity]?.attributes?.sounds || [];
  }

  _getSpeakers() {
    return this._config.speakers || [];
  }

  _getDurations() {
    return (this._config.durations || []).map((duration) =>
      typeof duration === "number"
        ? { label: this._durationLabel(duration), minutes: duration }
        : {
            label: duration.label || this._durationLabel(duration.minutes),
            minutes: Number(duration.minutes),
          }
    );
  }

  _selectedSoundObject() {
    return this._getSounds().find((sound) => sound.id === this._selectedSound) || this._getSounds()[0];
  }

  _selectedSpeakerName() {
    if (this._playTarget === "this_device") {
      return "This device";
    }
    const speaker = this._getSpeakers().find((item) => item.entity === this._selectedSpeaker);
    return speaker?.name || this._friendlyEntityName(this._selectedSpeaker) || "No speaker";
  }

  async _togglePlayback() {
    if (this._isPlaying) {
      await this._stop();
    } else {
      await this._play();
    }
  }

  async _play() {
    const sound = this._selectedSoundObject();
    if (!sound) {
      this._setMessage("No sounds found.");
      return;
    }
    if (this._playTarget === "speaker" && !this._selectedSpeaker) {
      this._setMessage("Choose a speaker first.");
      return;
    }

    try {
      if (this._playTarget === "this_device") {
        await this._playInThisDevice(sound);
      } else {
        const data = {
          speaker: this._selectedSpeaker,
          sound: sound.id,
          duration: this._selectedDuration,
        };
        if (this._config.show_volume !== false) {
          data.volume = this._volume;
        }
        await this._hass.callService("white_noise", "play", data);
      }

      this._isPlaying = true;
      this._startLocalTimer();
      this._setMessage(`Playing ${sound.name} on ${this._selectedSpeakerName()}.`);
      this._render();
    } catch (error) {
      this._setMessage(`Could not start playback: ${error.message || error}`);
    }
  }

  async _stop() {
    if (this._playTarget === "speaker" && !this._selectedSpeaker) {
      this._setMessage("Choose a speaker first.");
      return;
    }
    try {
      if (this._playTarget === "this_device") {
        this._stopThisDevice();
      } else {
        await this._hass.callService("white_noise", "stop", {
          speaker: this._selectedSpeaker,
        });
      }
      this._isPlaying = false;
      this._clearLocalTimer();
      this._setMessage(`Stopped ${this._selectedSpeakerName()}.`);
      this._render();
    } catch (error) {
      this._setMessage(`Could not stop playback: ${error.message || error}`);
    }
  }

  async _playInThisDevice(sound) {
    const resolved = await this._hass.callWS({
      type: "media_source/resolve_media",
      media_content_id: sound.media_content_id,
    });
    this._audio.pause();
    this._audio.src = resolved.url;
    this._audio.volume = this._volume / 100;
    this._audio.loop = true;
    await this._audio.play();
  }

  _stopThisDevice() {
    this._audio.pause();
    this._audio.currentTime = 0;
  }

  _startLocalTimer() {
    this._clearLocalTimer();
    if (!this._selectedDuration || this._selectedDuration <= 0) {
      return;
    }
    this._playTimer = window.setTimeout(() => this._stop(), this._selectedDuration * 60 * 1000);
  }

  _clearLocalTimer() {
    if (this._playTimer) {
      window.clearTimeout(this._playTimer);
      this._playTimer = undefined;
    }
  }

  _setMessage(message) {
    this._message = message;
    const messageElement = this.shadowRoot.querySelector(".message");
    if (messageElement) messageElement.textContent = message;
  }

  _durationLabel(minutes) {
    if (minutes === 0) return "No timer";
    if (minutes < 60) return `${minutes}m`;
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${minutes}m`;
  }

  _friendlyEntityName(entityId) {
    if (!entityId) return "";
    const state = this._hass?.states?.[entityId];
    return state?.attributes?.friendly_name || entityId.replace(/^media_player\./, "").replace(/_/g, " ");
  }

  _escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  _render() {
    if (!this.shadowRoot || !this._hass) return;

    const sounds = this._getSounds();
    const speakers = this._getSpeakers();
    const durations = this._getDurations();
    const selectedSound = this._selectedSoundObject();
    const compact = this._config.compact_mode;
    const canChooseTarget = this._config.allow_this_device !== false && speakers.length > 0;
    const showSpeakerPicker = this._playTarget === "speaker" && speakers.length > 1;
    const bgPercent = `${Math.max(0, Math.min(100, Number(this._config.background_opacity ?? 72)))}%`;
    const controlPercent = `${Math.max(0, Math.min(100, Number(this._config.control_opacity ?? 92)))}%`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --wn-accent: ${this._escape(this._config.accent_color)};
          --wn-bg: ${this._escape(this._config.background_color)};
          --wn-bg-percent: ${bgPercent};
          --wn-control-percent: ${controlPercent};
        }
        ha-card {
          overflow: hidden;
          color: var(--primary-text-color);
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--wn-bg) var(--wn-bg-percent), transparent), color-mix(in srgb, var(--wn-accent) 28%, var(--wn-bg))),
            var(--ha-card-background, var(--card-background-color));
          border-radius: var(--ha-card-border-radius, 8px);
        }
        .wrap {
          padding: ${compact ? "12px" : "16px"};
          display: grid;
          gap: ${compact ? "9px" : "13px"};
        }
        .head {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 10px;
        }
        .title {
          font-size: ${compact ? "15px" : "18px"};
          line-height: 1.1;
          font-weight: 750;
        }
        .target-pill {
          justify-self: end;
          max-width: 150px;
          padding: 5px 8px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--wn-accent) 22%, transparent);
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sound-name {
          font-size: ${compact ? "22px" : "28px"};
          line-height: 1.04;
          font-weight: 850;
          letter-spacing: 0;
        }
        .meta, label, .message {
          color: var(--secondary-text-color);
        }
        .meta {
          font-size: 12px;
          margin-top: 3px;
        }
        .controls {
          display: grid;
          gap: ${compact ? "8px" : "10px"};
        }
        .field {
          display: grid;
          gap: 5px;
        }
        label {
          font-size: 11px;
          font-weight: 700;
        }
        select {
          width: 100%;
          min-height: ${compact ? "38px" : "42px"};
          box-sizing: border-box;
          color: var(--primary-text-color);
          background: color-mix(in srgb, var(--card-background-color) var(--wn-control-percent), transparent);
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 8px 10px;
          font: inherit;
        }
        input[type="range"] {
          width: 100%;
          accent-color: var(--wn-accent);
        }
        .duration-row {
          display: grid;
          grid-template-columns: repeat(${Math.min(Math.max(durations.length, 1), 4)}, minmax(0, 1fr));
          gap: 6px;
        }
        button {
          border: 0;
          border-radius: 8px;
          min-height: ${compact ? "38px" : "42px"};
          cursor: pointer;
          font: inherit;
          font-weight: 800;
        }
        .chip {
          color: var(--primary-text-color);
          background: color-mix(in srgb, var(--card-background-color) var(--wn-control-percent), transparent);
        }
        .chip.active, .toggle {
          color: var(--text-primary-color);
          background: var(--wn-accent);
        }
        .toggle.playing {
          color: var(--primary-text-color);
          background: color-mix(in srgb, var(--card-background-color) var(--wn-control-percent), transparent);
        }
        .volume-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 12px;
          font-weight: 700;
        }
        .message {
          min-height: 15px;
          font-size: 11px;
        }
      </style>
      <ha-card>
        <div class="wrap">
          ${
            this._config.show_title
              ? `<div class="head"><div class="title">${this._escape(this._config.title)}</div><div class="target-pill">${this._escape(this._selectedSpeakerName())}</div></div>`
              : ""
          }
          ${
            this._config.show_current_sound === false && this._config.show_meta === false
              ? ""
              : `<div>
                  ${
                    this._config.show_current_sound === false
                      ? ""
                      : `<div class="sound-name">${this._escape(selectedSound?.name || "No Sounds")}</div>`
                  }
                  ${
                    this._config.show_meta === false
                      ? ""
                      : `<div class="meta">${this._escape(this._durationLabel(this._selectedDuration))} · ${this._volume}% · ${this._escape(this._selectedSpeakerName())}</div>`
                  }
                </div>`
          }
          <div class="controls">
            <div class="field">
              <label>Sound</label>
              <select class="sound">
                ${sounds.map((sound) => `<option value="${this._escape(sound.id)}" ${sound.id === this._selectedSound ? "selected" : ""}>${this._escape(sound.name)}</option>`).join("")}
              </select>
            </div>
            ${
              canChooseTarget
                ? `<div class="field"><label>Play from</label><select class="target"><option value="this_device" ${this._playTarget === "this_device" ? "selected" : ""}>This device</option><option value="speaker" ${this._playTarget === "speaker" ? "selected" : ""}>Speaker</option></select></div>`
                : ""
            }
            ${
              showSpeakerPicker
                ? `<div class="field"><label>Speaker</label><select class="speaker">${speakers.map((speaker) => `<option value="${this._escape(speaker.entity)}" ${speaker.entity === this._selectedSpeaker ? "selected" : ""}>${this._escape(speaker.name || this._friendlyEntityName(speaker.entity))}</option>`).join("")}</select></div>`
                : ""
            }
            ${
              durations.length
                ? `<div class="field"><label>Duration</label><div class="duration-row">${durations.map((duration) => `<button class="chip ${duration.minutes === this._selectedDuration ? "active" : ""}" data-duration="${duration.minutes}">${this._escape(duration.label)}</button>`).join("")}</div></div>`
                : ""
            }
            ${
              this._config.show_volume === false
                ? ""
                : `<div class="field"><div class="volume-head"><label>Volume</label><span class="volume-value">${this._volume}%</span></div><input class="volume" type="range" min="0" max="100" value="${this._volume}"></div>`
            }
          </div>
          <button class="toggle ${this._isPlaying ? "playing" : ""}">${this._isPlaying ? "Stop" : "Play"}</button>
          <div class="message">${this._escape(this._message || (sounds.length ? "Ready." : "No sounds found. Check sensor.white_noise_sounds."))}</div>
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelector(".sound")?.addEventListener("change", (event) => {
      this._selectedSound = event.target.value;
      this._isPlaying = false;
      this._clearLocalTimer();
      this._render();
    });
    this.shadowRoot.querySelector(".target")?.addEventListener("change", (event) => {
      this._stopThisDevice();
      this._isPlaying = false;
      this._clearLocalTimer();
      this._playTarget = event.target.value;
      this._render();
    });
    this.shadowRoot.querySelector(".speaker")?.addEventListener("change", (event) => {
      this._selectedSpeaker = event.target.value;
      this._isPlaying = false;
      this._clearLocalTimer();
      this._render();
    });
    this.shadowRoot.querySelectorAll(".chip").forEach((button) => {
      button.addEventListener("click", () => {
        this._selectedDuration = Number(button.dataset.duration);
        this._clearLocalTimer();
        if (this._isPlaying) this._startLocalTimer();
        this._render();
      });
    });
    this.shadowRoot.querySelector(".volume")?.addEventListener("input", (event) => {
      this._volume = Number(event.target.value);
      this._audio.volume = this._volume / 100;
      this.shadowRoot.querySelector(".volume-value").textContent = `${this._volume}%`;
    });
    this.shadowRoot.querySelector(".toggle")?.addEventListener("click", () => this._togglePlayback());
  }
}

class WhiteNoiseCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._speakerPicker = "";
  }

  setConfig(config) {
    this._config = { ...WhiteNoiseCard.getStubConfig(), ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _mediaPlayers() {
    const seenNames = new Set();

    return Object.entries(this._hass?.states || {})
      .filter(([entityId, state]) => {
        if (!entityId.startsWith("media_player.")) return false;

        const friendlyName = state.attributes?.friendly_name || "";
        const searchable = `${entityId} ${friendlyName}`.toLowerCase();

        if (!this._config.show_browser_mod_speakers && searchable.includes("browser_mod")) {
          return false;
        }

        if (!this._config.show_browser_mod_speakers && searchable.includes("browser mod")) {
          return false;
        }

        if (!this._config.show_unavailable_speakers && ["unavailable", "unknown"].includes(state.state)) {
          return false;
        }

        return true;
      })
      .map(([entityId, state]) => ({
        entity: entityId,
        name: state.attributes?.friendly_name || entityId.replace(/^media_player\./, "").replace(/_/g, " "),
      }))
      .filter((player) => {
        const key = player.name.trim().toLowerCase();
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _durationPresets() {
    return [
      { label: "5m", minutes: 5 },
      { label: "10m", minutes: 10 },
      { label: "15m", minutes: 15 },
      { label: "30m", minutes: 30 },
      { label: "45m", minutes: 45 },
      { label: "1h", minutes: 60 },
      { label: "2h", minutes: 120 },
      { label: "No timer", minutes: 0 },
    ];
  }

  _durationEnabled(minutes) {
    return (this._config.durations || []).some((duration) => Number(duration.minutes) === Number(minutes));
  }

  _updateConfig(changes) {
    this._config = { ...this._config, ...changes };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
    this._render();
  }

  _addSpeaker(entityId) {
    if (!entityId) return;
    const players = this._mediaPlayers();
    const player = players.find((item) => item.entity === entityId);
    const speakers = [...(this._config.speakers || [])];
    if (!speakers.some((speaker) => speaker.entity === entityId)) {
      speakers.push({ entity: entityId, name: player?.name || entityId });
    }
    this._updateConfig({ speakers });
  }

  _removeSpeaker(entityId) {
    this._updateConfig({
      speakers: (this._config.speakers || []).filter((speaker) => speaker.entity !== entityId),
    });
  }

  _toggleDuration(preset, checked) {
    const durations = (this._config.durations || []).filter(
      (duration) => Number(duration.minutes) !== Number(preset.minutes)
    );
    if (checked) durations.push(preset);
    durations.sort((a, b) => Number(a.minutes) - Number(b.minutes));
    this._updateConfig({ durations });
  }

  _escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  _render() {
    if (!this.shadowRoot) return;
    const players = this._mediaPlayers();
    const speakers = this._config.speakers || [];
    const presets = this._durationPresets();

    this.shadowRoot.innerHTML = `
      <style>
        .editor { display: grid; gap: 14px; padding: 4px 0; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .field { display: grid; gap: 6px; }
        label { color: var(--secondary-text-color); font-size: 12px; font-weight: 700; }
        input, select {
          box-sizing: border-box; width: 100%; min-height: 40px;
          color: var(--primary-text-color); background: var(--card-background-color);
          border: 1px solid var(--divider-color); border-radius: 8px; padding: 8px 10px; font: inherit;
        }
        input[type="checkbox"] { width: auto; min-height: auto; }
        input[type="color"] { padding: 3px; }
        .check { display: flex; gap: 8px; align-items: center; }
        .speaker-add { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
        button {
          border: 0; border-radius: 8px; min-height: 40px; padding: 0 12px;
          color: var(--text-primary-color); background: var(--primary-color); font-weight: 800;
        }
        .speaker-list { display: grid; gap: 6px; }
        .speaker-item {
          display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center;
          padding: 8px 10px; border-radius: 8px; background: var(--secondary-background-color);
        }
        .speaker-item button { min-height: 30px; color: var(--primary-text-color); background: var(--card-background-color); }
        .duration-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .hint { color: var(--secondary-text-color); font-size: 11px; line-height: 1.35; }
      </style>
      <div class="editor">
        <label class="check"><input class="show-title" type="checkbox" ${this._config.show_title ? "checked" : ""}> Show heading</label>
        <label class="check"><input class="show-current-sound" type="checkbox" ${this._config.show_current_sound !== false ? "checked" : ""}> Show current sound title</label>
        <label class="check"><input class="show-meta" type="checkbox" ${this._config.show_meta !== false ? "checked" : ""}> Show subtitle</label>
        <div class="field"><label>Heading text</label><input class="title" value="${this._escape(this._config.title)}"></div>
        <div class="row">
          <div class="field"><label>Accent colour</label><input class="accent-color" type="color" value="${this._escape(this._config.accent_color)}"></div>
          <div class="field"><label>Background colour</label><input class="background-color" type="color" value="${this._escape(this._config.background_color)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Background opacity: ${this._config.background_opacity}%</label><input class="background-opacity" type="range" min="20" max="100" value="${this._config.background_opacity}"></div>
          <div class="field"><label>Control opacity: ${this._config.control_opacity}%</label><input class="control-opacity" type="range" min="20" max="100" value="${this._config.control_opacity}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Default target</label><select class="default-target"><option value="this_device" ${this._config.default_play_target === "this_device" ? "selected" : ""}>This device</option><option value="speaker" ${this._config.default_play_target === "speaker" ? "selected" : ""}>Speaker</option></select></div>
          <div class="field"><label>Default speaker</label><select class="default-speaker"><option value="">None</option>${players.map((player) => `<option value="${this._escape(player.entity)}" ${this._config.default_speaker === player.entity ? "selected" : ""}>${this._escape(player.name)}</option>`).join("")}</select></div>
        </div>
        <div class="row">
          <div class="field"><label>Default duration if no timer buttons</label><input class="default-duration" type="number" min="0" value="${this._escape(this._config.default_duration)}"></div>
          <div class="field"><label>Default volume</label><input class="default-volume" type="number" min="0" max="100" value="${this._escape(this._config.default_volume)}"></div>
        </div>
        <label class="check"><input class="allow-this-device" type="checkbox" ${this._config.allow_this_device ? "checked" : ""}> Allow this device</label>
        <label class="check"><input class="show-browser-mod-speakers" type="checkbox" ${this._config.show_browser_mod_speakers ? "checked" : ""}> Show Browser Mod players</label>
        <label class="check"><input class="show-unavailable-speakers" type="checkbox" ${this._config.show_unavailable_speakers ? "checked" : ""}> Show unavailable players</label>
        <label class="check"><input class="compact-mode" type="checkbox" ${this._config.compact_mode ? "checked" : ""}> Compact mode</label>
        <div class="field">
          <label>Add speakers from Home Assistant</label>
          <div class="speaker-add"><select class="speaker-picker"><option value="">Choose a media player</option>${players.map((player) => `<option value="${this._escape(player.entity)}">${this._escape(player.name)}</option>`).join("")}</select><button class="add-speaker">Add</button></div>
          <div class="speaker-list">${speakers.map((speaker) => `<div class="speaker-item"><span>${this._escape(speaker.name || speaker.entity)}</span><button data-remove="${this._escape(speaker.entity)}">Remove</button></div>`).join("")}</div>
        </div>
        <div class="field">
          <label>Timer buttons</label>
          <div class="duration-grid">${presets.map((preset) => `<label class="check"><input class="duration" type="checkbox" data-minutes="${preset.minutes}" ${this._durationEnabled(preset.minutes) ? "checked" : ""}> ${this._escape(preset.label)}</label>`).join("")}</div>
          <div class="hint">Only ticked timers appear as buttons. If none are ticked, the card uses the default duration without showing timer buttons.</div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelector(".show-title")?.addEventListener("change", (event) => this._updateConfig({ show_title: event.target.checked }));
    this.shadowRoot.querySelector(".show-current-sound")?.addEventListener("change", (event) => this._updateConfig({ show_current_sound: event.target.checked }));
    this.shadowRoot.querySelector(".show-meta")?.addEventListener("change", (event) => this._updateConfig({ show_meta: event.target.checked }));
    this.shadowRoot.querySelector(".title")?.addEventListener("change", (event) => this._updateConfig({ title: event.target.value }));
    this.shadowRoot.querySelector(".accent-color")?.addEventListener("change", (event) => this._updateConfig({ accent_color: event.target.value }));
    this.shadowRoot.querySelector(".background-color")?.addEventListener("change", (event) => this._updateConfig({ background_color: event.target.value }));
    this.shadowRoot.querySelector(".background-opacity")?.addEventListener("change", (event) => this._updateConfig({ background_opacity: Number(event.target.value) }));
    this.shadowRoot.querySelector(".control-opacity")?.addEventListener("change", (event) => this._updateConfig({ control_opacity: Number(event.target.value) }));
    this.shadowRoot.querySelector(".default-target")?.addEventListener("change", (event) => this._updateConfig({ default_play_target: event.target.value }));
    this.shadowRoot.querySelector(".default-speaker")?.addEventListener("change", (event) => this._updateConfig({ default_speaker: event.target.value }));
    this.shadowRoot.querySelector(".default-duration")?.addEventListener("change", (event) => this._updateConfig({ default_duration: Number(event.target.value) }));
    this.shadowRoot.querySelector(".default-volume")?.addEventListener("change", (event) => this._updateConfig({ default_volume: Number(event.target.value) }));
    this.shadowRoot.querySelector(".allow-this-device")?.addEventListener("change", (event) => this._updateConfig({ allow_this_device: event.target.checked }));
    this.shadowRoot.querySelector(".show-browser-mod-speakers")?.addEventListener("change", (event) => this._updateConfig({ show_browser_mod_speakers: event.target.checked }));
    this.shadowRoot.querySelector(".show-unavailable-speakers")?.addEventListener("change", (event) => this._updateConfig({ show_unavailable_speakers: event.target.checked }));
    this.shadowRoot.querySelector(".compact-mode")?.addEventListener("change", (event) => this._updateConfig({ compact_mode: event.target.checked }));
    this.shadowRoot.querySelector(".speaker-picker")?.addEventListener("change", (event) => { this._speakerPicker = event.target.value; });
    this.shadowRoot.querySelector(".add-speaker")?.addEventListener("click", () => this._addSpeaker(this._speakerPicker));
    this.shadowRoot.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => this._removeSpeaker(button.dataset.remove)));
    this.shadowRoot.querySelectorAll(".duration").forEach((box) => box.addEventListener("change", () => {
      const preset = this._durationPresets().find((item) => Number(item.minutes) === Number(box.dataset.minutes));
      this._toggleDuration(preset, box.checked);
    }));
  }
}

if (!customElements.get("white-noise-card")) customElements.define("white-noise-card", WhiteNoiseCard);
if (!customElements.get("white-noise-card-editor")) customElements.define("white-noise-card-editor", WhiteNoiseCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "white-noise-card",
  name: "White Noise Card",
  description: "Play white noise sounds on this device or a selected media player.",
});
