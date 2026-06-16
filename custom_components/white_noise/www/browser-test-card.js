class WhiteNoiseBrowserTestCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._audio = new Audio();
    this._selectedSound = "";
    this._volume = 50;
  }

  setConfig(config) {
    this._config = {
      entity: "sensor.white_noise_sounds",
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  _getSounds() {
    const entity = this._hass?.states?.[this._config.entity];
    return entity?.attributes?.sounds || [];
  }

  _mediaContentId(sound) {
    return (
      sound.media_content_id ||
      `media-source://media_source/local/white_noise/${sound.file_name}`
    );
  }

  async _playSelected() {
    const sounds = this._getSounds();
    const sound =
      sounds.find((item) => item.id === this._selectedSound) || sounds[0];

    if (!sound) {
      this._setMessage("No sounds found. Refresh the integration or check the media folder.");
      return;
    }

    this._selectedSound = sound.id;

    try {
      const resolved = await this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: this._mediaContentId(sound),
      });

      this._audio.pause();
      this._audio.src = resolved.url;
      this._audio.volume = this._volume / 100;
      await this._audio.play();
      this._setMessage(`Playing ${sound.name} in this browser.`);
    } catch (error) {
      this._setMessage(`Could not play in browser: ${error.message || error}`);
    }
  }

  _stop() {
    this._audio.pause();
    this._audio.currentTime = 0;
    this._setMessage("Stopped browser playback.");
  }

  _setMessage(message) {
    const messageElement = this.shadowRoot.querySelector(".message");
    if (messageElement) {
      messageElement.textContent = message;
    }
  }

  _render() {
    if (!this.shadowRoot || !this._hass) {
      return;
    }

    const sounds = this._getSounds();
    if (!this._selectedSound && sounds.length > 0) {
      this._selectedSound = sounds[0].id;
    }

    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          padding: 16px;
          color: var(--primary-text-color);
        }

        .title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .row {
          display: grid;
          gap: 8px;
          margin-bottom: 12px;
        }

        label {
          color: var(--secondary-text-color);
          font-size: 12px;
        }

        select,
        input {
          width: 100%;
          box-sizing: border-box;
          color: var(--primary-text-color);
          background: var(--card-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 10px;
        }

        .buttons {
          display: flex;
          gap: 8px;
        }

        button {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 600;
        }

        .play {
          background: var(--primary-color);
          color: var(--text-primary-color);
        }

        .stop {
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
        }

        .message {
          min-height: 18px;
          color: var(--secondary-text-color);
          font-size: 12px;
          margin-top: 10px;
        }
      </style>

      <ha-card>
        <div class="title">White Noise Browser Test</div>

        <div class="row">
          <label>Sound</label>
          <select class="sound">
            ${sounds
              .map(
                (sound) =>
                  `<option value="${sound.id}" ${
                    sound.id === this._selectedSound ? "selected" : ""
                  }>${sound.name}</option>`
              )
              .join("")}
          </select>
        </div>

        <div class="row">
          <label>Browser volume: <span class="volume-label">${this._volume}%</span></label>
          <input class="volume" type="range" min="0" max="100" value="${this._volume}">
        </div>

        <div class="buttons">
          <button class="play">Play in Browser</button>
          <button class="stop">Stop</button>
        </div>

        <div class="message">${
          sounds.length > 0
            ? "This plays only in the browser tab you are using."
            : "No sounds found yet."
        }</div>
      </ha-card>
    `;

    this.shadowRoot.querySelector(".sound")?.addEventListener("change", (event) => {
      this._selectedSound = event.target.value;
    });

    this.shadowRoot.querySelector(".volume")?.addEventListener("input", (event) => {
      this._volume = Number(event.target.value);
      this._audio.volume = this._volume / 100;
      this.shadowRoot.querySelector(".volume-label").textContent = `${this._volume}%`;
    });

    this.shadowRoot.querySelector(".play")?.addEventListener("click", () => {
      this._playSelected();
    });

    this.shadowRoot.querySelector(".stop")?.addEventListener("click", () => {
      this._stop();
    });
  }
}

customElements.define("white-noise-browser-test-card", WhiteNoiseBrowserTestCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "white-noise-browser-test-card",
  name: "White Noise Browser Test Card",
  description: "Preview White Noise files in the current browser window.",
});
