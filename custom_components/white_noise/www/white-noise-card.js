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
      show_browser_preview: false,
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
    const speaker = this._getSpeakers().find(
      (item) => item.entity === this._selectedSpeaker
    );
    return speaker?.name || this._friendlyEntityName(this._selectedSpeaker) || "No speaker";
  }

  async _play() {
    const sound = this._selectedSoundObject();
    if (!this._selectedSpeaker) {
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

      await this._hass.callService("white_noise", "play", data);
      this._setMessage(`Playing ${sound.name} on ${this._selectedSpeakerName()}.`);
    } catch (error) {
      this._setMessage(`Could not start playback: ${error.message || error}`);
    }
  }

  async _stop() {
    if (!this._selectedSpeaker) {
      this._setMessage("Choose a speaker first.");
      return;
    }

    try {
      await this._hass.callService("white_noise", "stop", {
        speaker: this._selectedSpeaker,
      });
      this._setMessage(`Stopped ${this._selectedSpeakerName()}.`);
    } catch (error) {
      this._setMessage(`Could not stop playback: ${error.message || error}`);
    }
  }

  async _previewInBrowser() {
    const sound = this._selectedSoundObject();
    if (!sound) {
      this._setMessage("No sounds found.");
      return;
    }

    try {
      const resolved = await this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: sound.media_content_id,
      });

      this._audio.pause();
      this._audio.src = resolved.url;
      this._audio.volume = this._volume / 100;
      await this._audio.play();
      this._setMessage(`Previewing ${sound.name} in this browser.`);
    } catch (error) {
      this._setMessage(`Could not preview in browser: ${error.message || error}`);
    }
  }

  _stopBrowserPreview() {
    this._audio.pause();
    this._audio.currentTime = 0;
    this._setMessage("Stopped browser preview.");
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

        .actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .play {
          color: var(--text-primary-color);
          background: var(--wn-accent);
        }

        .stop,
        .preview {
          color: var(--primary-text-color);
          background: var(--secondary-background-color);
        }

        .preview-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
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
              speakers.length > 1
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

          <div class="actions">
            <button class="stop">Stop</button>
            <button class="play">Play</button>
          </div>

          ${
            this._config.show_browser_preview
              ? `<div class="preview-row">
                  <button class="preview browser-play">Preview</button>
                  <button class="preview browser-stop">Stop Preview</button>
                </div>`
              : ""
          }

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
      this._render();
    });

    this.shadowRoot.querySelector(".speaker")?.addEventListener("change", (event) => {
      this._selectedSpeaker = event.target.value;
      this._render();
    });

    this.shadowRoot.querySelectorAll(".chip").forEach((button) => {
      button.addEventListener("click", () => {
        this._selectedDuration = Number(button.dataset.duration);
        this._render();
      });
    });

    this.shadowRoot.querySelector(".volume")?.addEventListener("input", (event) => {
      this._volume = Number(event.target.value);
      this._audio.volume = this._volume / 100;
      this.shadowRoot.querySelector(".volume-value").textContent = `${this._volume}%`;
    });

    this.shadowRoot.querySelector(".play")?.addEventListener("click", () => this._play());
    this.shadowRoot.querySelector(".stop")?.addEventListener("click", () => this._stop());
    this.shadowRoot
      .querySelector(".browser-play")
      ?.addEventListener("click", () => this._previewInBrowser());
    this.shadowRoot
      .querySelector(".browser-stop")
      ?.addEventListener("click", () => this._stopBrowserPreview());
  }
}

customElements.define("white-noise-card", WhiteNoiseCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "white-noise-card",
  name: "White Noise Card",
  description: "Play white noise sounds on a selected media player.",
});
