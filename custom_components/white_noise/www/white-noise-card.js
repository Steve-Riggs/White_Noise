class WhiteNoiseCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._selectedSound = "";
    this._selectedSpeaker = "";
    this._selectedDuration = 60;
    this._volume = 20;
    this._message = "";
    this._audio = new Audio();
    this._playTarget = "speaker";
    this._isPlaying = false;
    this._playTimer = undefined;
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid card configuration");
    }

    this._config = {
      entity: "sensor.white_noise_sounds",
      title: "White Noise",
      speakers: [],
      durations: [15, 30, 60, 120],
      default_duration: 60,
      default_volume: 20,
      compact_mode: false,
      allow_this_device: true,
      default_play_target: "speaker",
      show_volume: true,
      accent_color: "var(--primary-color)",
      ...config,
    };

    this._selectedSpeaker =
      this._config.default_speaker ||
      this._config.speaker ||
      this._config.speakers?.[0]?.entity ||
      "";
    this._selectedDuration = Number(this._config.default_duration || 60);
    this._volume = Number(this._config.default_volume || 20);
    this._playTarget =
      this._config.default_play_target === "this_device" ||
      this._config.default_play_target === "browser"
        ? "this_device"
        : "speaker";

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
      compact_mode: false,
      allow_this_device: true,
      default_play_target: "this_device",
      default_duration: 60,
      default_volume: 20,
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
    const entity = this._hass?.states?.[this._config.entity];
    return entity?.attributes?.sounds || [];
  }

  _getSpeakers() {
    return this._config.speakers || [];
  }

  _getDurations() {
    return (this._config.durations || [15, 30, 60, 120]).map((duration) => {
      if (typeof duration === "number") {
        return { label: this._durationLabel(duration), minutes: duration };
      }

      return {
        label: duration.label || this._durationLabel(duration.minutes),
        minutes: Number(duration.minutes),
      };
    });
  }

  _selectedSoundObject() {
    const sounds = this._getSounds();
    return sounds.find((sound) => sound.id === this._selectedSound) || sounds[0];
  }

  _selectedSpeakerName() {
    if (this._playTarget === "this_device") {
      return "This device";
    }

    const speaker = this._getSpeakers().find(
      (item) => item.entity === this._selectedSpeaker
    );
    return speaker?.name || this._friendlyEntityName(this._selectedSpeaker) || "No speaker";
  }

  async _togglePlayback() {
    if (this._isPlaying) {
      await this._stop();
      return;
    }

    await this._play();
  }

  async _play() {
    const sound = this._selectedSoundObject();
    if (this._playTarget === "speaker" && !this._selectedSpeaker) {
      this._setMessage("Choose a speaker first.");
      return;
    }

    if (!sound) {
      this._setMessage("No sounds found.");
      return;
    }

    try {
      const data = {
        speaker: this._selectedSpeaker,
        sound: sound.id,
        duration: this._selectedDuration,
      };

      if (this._config.show_volume !== false) {
        data.volume = this._volume;
      }

      if (this._playTarget === "this_device") {
        await this._playInThisDevice(sound);
      } else {
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

    this._playTimer = window.setTimeout(() => {
      this._stop();
    }, this._selectedDuration * 60 * 1000);
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
    if (messageElement) {
      messageElement.textContent = message;
    }
  }

  _durationLabel(minutes) {
    if (minutes === 0) {
      return "No timer";
    }
    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${minutes}m`;
  }

  _friendlyEntityName(entityId) {
    if (!entityId) {
      return "";
    }

    const state = this._hass?.states?.[entityId];
    if (state?.attributes?.friendly_name) {
      return state.attributes.friendly_name;
    }

    return entityId.replace(/^media_player\./, "").replace(/_/g, " ");
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
    if (!this.shadowRoot || !this._hass) {
      return;
    }

    const sounds = this._getSounds();
    const speakers = this._getSpeakers();
    const durations = this._getDurations();
    const selectedSound = this._selectedSoundObject();
    const compact = this._config.compact_mode;
    const accentColor = this._config.accent_color || "var(--primary-color)";
    const canChooseTarget =
      this._config.allow_this_device !== false && speakers.length > 0;
    const showSpeakerPicker =
      this._playTarget === "speaker" && speakers.length > 1;
    const playLabel = this._isPlaying ? "Stop" : "Play";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --wn-accent: ${this._escape(accentColor)};
        }

        ha-card {
          overflow: hidden;
          color: var(--primary-text-color);
          background: var(--ha-card-background, var(--card-background-color));
          border-radius: var(--ha-card-border-radius, 8px);
        }

        .wrap {
          padding: ${compact ? "12px" : "16px"};
          display: grid;
          gap: ${compact ? "10px" : "14px"};
        }

        .head {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: start;
          gap: 12px;
        }

        .title {
          font-size: ${compact ? "15px" : "18px"};
          line-height: 1.1;
          font-weight: 700;
        }

        .speaker-pill {
          max-width: 142px;
          padding: 5px 8px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--wn-accent) 18%, transparent);
          color: var(--primary-text-color);
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .now {
          display: grid;
          gap: 4px;
        }

        .sound-name {
          font-size: ${compact ? "20px" : "26px"};
          line-height: 1.05;
          font-weight: 800;
          letter-spacing: 0;
        }

        .meta {
          color: var(--secondary-text-color);
          font-size: 12px;
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
          color: var(--secondary-text-color);
          font-size: 11px;
          font-weight: 600;
        }

        select,
        input[type="range"] {
          width: 100%;
          box-sizing: border-box;
        }

        select {
          min-height: ${compact ? "38px" : "42px"};
          color: var(--primary-text-color);
          background: var(--secondary-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 8px 10px;
          font: inherit;
        }

        input[type="range"] {
          accent-color: var(--wn-accent);
        }

        .duration-row {
          display: grid;
          grid-template-columns: repeat(${Math.min(durations.length || 1, 4)}, minmax(0, 1fr));
          gap: 6px;
        }

        .chip,
        button {
          border: 0;
          border-radius: 8px;
          min-height: ${compact ? "38px" : "42px"};
          cursor: pointer;
          font: inherit;
          font-weight: 700;
        }

        .chip {
          color: var(--primary-text-color);
          background: var(--secondary-background-color);
        }

        .chip.active {
          color: var(--text-primary-color);
          background: var(--wn-accent);
        }

        .volume-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .volume-value {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 700;
        }

        .toggle {
          color: var(--text-primary-color);
          background: var(--wn-accent);
        }

        .toggle.playing {
          color: var(--primary-text-color);
          background: var(--secondary-background-color);
        }

        .message {
          min-height: 16px;
          color: var(--secondary-text-color);
          font-size: 11px;
        }

        @media (max-width: 420px) {
          .wrap {
            padding: 12px;
            gap: 10px;
          }

          .sound-name {
            font-size: 20px;
          }

          .speaker-pill {
            max-width: 110px;
          }
        }
      </style>

      <ha-card>
        <div class="wrap">
          <div class="head">
            <div class="title">${this._escape(this._config.title)}</div>
            <div class="speaker-pill">${this._escape(this._selectedSpeakerName())}</div>
          </div>

          <div class="now">
            <div class="sound-name">${this._escape(selectedSound?.name || "No Sounds")}</div>
            <div class="meta">${this._escape(this._durationLabel(this._selectedDuration))} · ${this._volume}%</div>
          </div>

          <div class="controls">
            <div class="field">
              <label>Sound</label>
              <select class="sound">
                ${sounds
                  .map(
                    (sound) =>
                      `<option value="${this._escape(sound.id)}" ${
                        sound.id === this._selectedSound ? "selected" : ""
                      }>${this._escape(sound.name)}</option>`
                  )
                  .join("")}
              </select>
            </div>

            ${
              canChooseTarget
                ? `<div class="field">
                    <label>Play from</label>
                    <select class="target">
                      <option value="this_device" ${
                        this._playTarget === "this_device" ? "selected" : ""
                      }>This device</option>
                      <option value="speaker" ${
                        this._playTarget === "speaker" ? "selected" : ""
                      }>Speaker</option>
                    </select>
                  </div>`
                : ""
            }

            ${
              showSpeakerPicker
                ? `<div class="field">
                    <label>Speaker</label>
                    <select class="speaker">
                      ${speakers
                        .map(
                          (speaker) =>
                            `<option value="${this._escape(speaker.entity)}" ${
                              speaker.entity === this._selectedSpeaker
                                ? "selected"
                                : ""
                            }>${this._escape(speaker.name || this._friendlyEntityName(speaker.entity))}</option>`
                        )
                        .join("")}
                    </select>
                  </div>`
                : ""
            }

            <div class="field">
              <label>Duration</label>
              <div class="duration-row">
                ${durations
                  .map(
                    (duration) =>
                      `<button class="chip ${
                        duration.minutes === this._selectedDuration ? "active" : ""
                      }" data-duration="${duration.minutes}">${this._escape(duration.label)}</button>`
                  )
                  .join("")}
              </div>
            </div>

            ${
              this._config.show_volume === false
                ? ""
                : `<div class="field">
                    <div class="volume-head">
                      <label>Volume</label>
                      <span class="volume-value">${this._volume}%</span>
                    </div>
                    <input class="volume" type="range" min="0" max="100" value="${this._volume}">
                  </div>`
            }
          </div>

          <button class="toggle ${this._isPlaying ? "playing" : ""}">${playLabel}</button>

          <div class="message">${this._escape(
            this._message ||
              (sounds.length > 0
                ? "Ready."
                : "No sounds found. Check sensor.white_noise_sounds.")
          )}</div>
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
        if (this._isPlaying) {
          this._startLocalTimer();
        }
        this._render();
      });
    });

    this.shadowRoot.querySelector(".volume")?.addEventListener("input", (event) => {
      this._volume = Number(event.target.value);
      this._audio.volume = this._volume / 100;
      this.shadowRoot.querySelector(".volume-value").textContent = `${this._volume}%`;
    });

    this.shadowRoot
      .querySelector(".toggle")
      ?.addEventListener("click", () => this._togglePlayback());
  }
}

if (!customElements.get("white-noise-card")) {
  customElements.define("white-noise-card", WhiteNoiseCard);
}

class WhiteNoiseCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...WhiteNoiseCard.getStubConfig(), ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _value(key, fallback = "") {
    return this._config[key] ?? fallback;
  }

  _speakersText() {
    return (this._config.speakers || [])
      .map((speaker) => `${speaker.entity}${speaker.name ? ` | ${speaker.name}` : ""}`)
      .join("\n");
  }

  _durationsText() {
    return (this._config.durations || [])
      .map((duration) => {
        if (typeof duration === "number") {
          return `${duration}`;
        }
        return `${duration.label || duration.minutes} | ${duration.minutes}`;
      })
      .join("\n");
  }

  _parseSpeakers(value) {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [entity, name] = line.split("|").map((item) => item.trim());
        return name ? { entity, name } : { entity };
      });
  }

  _parseDurations(value) {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        if (!line.includes("|")) {
          const minutes = Number(line);
          return { label: `${minutes}m`, minutes };
        }
        const [label, minutes] = line.split("|").map((item) => item.trim());
        return { label, minutes: Number(minutes) };
      })
      .filter((duration) => Number.isFinite(duration.minutes));
  }

  _updateConfig(changes) {
    this._config = { ...this._config, ...changes };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
    this._render();
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        .editor {
          display: grid;
          gap: 14px;
          padding: 4px 0;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        label {
          color: var(--secondary-text-color);
          font-size: 12px;
          font-weight: 600;
        }

        input,
        select,
        textarea {
          box-sizing: border-box;
          width: 100%;
          min-height: 40px;
          color: var(--primary-text-color);
          background: var(--card-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 8px 10px;
          font: inherit;
        }

        textarea {
          min-height: 84px;
          resize: vertical;
          font-family: var(--code-font-family, monospace);
          font-size: 12px;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .hint {
          color: var(--secondary-text-color);
          font-size: 11px;
          line-height: 1.35;
        }

        .check {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .check input {
          width: auto;
          min-height: auto;
        }
      </style>

      <div class="editor">
        <div class="field">
          <label>Title</label>
          <input class="title" value="${this._escape(this._value("title", "White Noise"))}">
        </div>

        <div class="field">
          <label>Sound entity</label>
          <input class="entity" value="${this._escape(this._value("entity", "sensor.white_noise_sounds"))}">
        </div>

        <div class="row">
          <div class="field">
            <label>Default target</label>
            <select class="default-play-target">
              <option value="this_device" ${
                this._value("default_play_target") === "this_device" ? "selected" : ""
              }>This device</option>
              <option value="speaker" ${
                this._value("default_play_target") === "speaker" ? "selected" : ""
              }>Speaker</option>
            </select>
          </div>

          <div class="field">
            <label>Default speaker</label>
            <input class="default-speaker" value="${this._escape(this._value("default_speaker"))}">
          </div>
        </div>

        <div class="row">
          <div class="field">
            <label>Default duration</label>
            <input class="default-duration" type="number" min="0" value="${this._escape(this._value("default_duration", 60))}">
          </div>

          <div class="field">
            <label>Default volume</label>
            <input class="default-volume" type="number" min="0" max="100" value="${this._escape(this._value("default_volume", 20))}">
          </div>
        </div>

        <div class="field">
          <label>Accent colour</label>
          <input class="accent-color" value="${this._escape(this._value("accent_color", "var(--primary-color)"))}">
        </div>

        <label class="check">
          <input class="compact-mode" type="checkbox" ${this._value("compact_mode") ? "checked" : ""}>
          Compact mode
        </label>

        <label class="check">
          <input class="allow-this-device" type="checkbox" ${
            this._value("allow_this_device", true) ? "checked" : ""
          }>
          Allow playback from this device
        </label>

        <div class="field">
          <label>Speakers</label>
          <textarea class="speakers">${this._escape(this._speakersText())}</textarea>
          <div class="hint">One per line: media_player.nursery_speaker | Nursery</div>
        </div>

        <div class="field">
          <label>Durations</label>
          <textarea class="durations">${this._escape(this._durationsText())}</textarea>
          <div class="hint">One per line: 15m | 15. Use 0 for no timer.</div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelector(".title")?.addEventListener("change", (event) => {
      this._updateConfig({ title: event.target.value });
    });
    this.shadowRoot.querySelector(".entity")?.addEventListener("change", (event) => {
      this._updateConfig({ entity: event.target.value });
    });
    this.shadowRoot
      .querySelector(".default-play-target")
      ?.addEventListener("change", (event) => {
        this._updateConfig({ default_play_target: event.target.value });
      });
    this.shadowRoot
      .querySelector(".default-speaker")
      ?.addEventListener("change", (event) => {
        this._updateConfig({ default_speaker: event.target.value });
      });
    this.shadowRoot
      .querySelector(".default-duration")
      ?.addEventListener("change", (event) => {
        this._updateConfig({ default_duration: Number(event.target.value) });
      });
    this.shadowRoot
      .querySelector(".default-volume")
      ?.addEventListener("change", (event) => {
        this._updateConfig({ default_volume: Number(event.target.value) });
      });
    this.shadowRoot
      .querySelector(".accent-color")
      ?.addEventListener("change", (event) => {
        this._updateConfig({ accent_color: event.target.value });
      });
    this.shadowRoot
      .querySelector(".compact-mode")
      ?.addEventListener("change", (event) => {
        this._updateConfig({ compact_mode: event.target.checked });
      });
    this.shadowRoot
      .querySelector(".allow-this-device")
      ?.addEventListener("change", (event) => {
        this._updateConfig({ allow_this_device: event.target.checked });
      });
    this.shadowRoot.querySelector(".speakers")?.addEventListener("change", (event) => {
      this._updateConfig({ speakers: this._parseSpeakers(event.target.value) });
    });
    this.shadowRoot.querySelector(".durations")?.addEventListener("change", (event) => {
      this._updateConfig({ durations: this._parseDurations(event.target.value) });
    });
  }

  _escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

if (!customElements.get("white-noise-card-editor")) {
  customElements.define("white-noise-card-editor", WhiteNoiseCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "white-noise-card",
  name: "White Noise Card",
  description: "Play white noise sounds on a selected media player.",
});
