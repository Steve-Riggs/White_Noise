class WhiteNoiseBrowserTestCard extends HTMLElement {
  setConfig(config) {
    this._config = { entity: "sensor.white_noise_sounds", ...config };
    this.attachShadow({ mode: "open" });
    this._audio = new Audio();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    const sounds = this._hass?.states?.[this._config.entity]?.attributes?.sounds || [];
    this.shadowRoot.innerHTML = `
      <ha-card style="padding:16px;display:block">
        <div style="font-weight:700;margin-bottom:12px">Browser audio test</div>
        <select style="width:100%;margin-bottom:8px" class="sound">
          ${sounds.map((sound) => `<option value="${sound.id}">${sound.name}</option>`).join("")}
        </select>
        <button class="play">Play</button>
        <button class="stop">Stop</button>
      </ha-card>
    `;
    this.shadowRoot.querySelector(".play")?.addEventListener("click", async () => {
      const id = this.shadowRoot.querySelector(".sound").value;
      const sound = sounds.find((item) => item.id === id);
      const resolved = await this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: sound.media_content_id,
      });
      this._audio.src = resolved.url;
      this._audio.loop = true;
      await this._audio.play();
    });
    this.shadowRoot.querySelector(".stop")?.addEventListener("click", () => {
      this._audio.pause();
      this._audio.currentTime = 0;
    });
  }
}

if (!customElements.get("white-noise-browser-test-card")) customElements.define("white-noise-browser-test-card", WhiteNoiseBrowserTestCard);
