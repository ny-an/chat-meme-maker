const characterArtwork = new Map();

async function loadCharacterArtwork() {
  const decoded = await Promise.all(Object.entries(spriteAssets).map(async ([species, asset]) => {
    const image = new Image();
    image.src = asset.source;
    await image.decode();
    return [species, { image, width: asset.width, height: asset.height, frames: asset.frames }];
  }));
  for (const [species, artwork] of decoded) {
    characterArtwork.set(species, artwork);
  }
}

function renderMeme(canvas, state) {
  const ctx = canvas.getContext('2d');
  const sans = 'system-ui, "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif';
  const mono = 'ui-monospace, "Hiragino Sans", "Yu Gothic", Meiryo, monospace';
  const fonts = {
    bold: { family: sans, title: 900, name: 850, bubble: 700, meta: 650, timestamp: mono },
    gothic: {
      family: '"Hiragino Sans", "Yu Gothic", Meiryo, sans-serif',
      title: 600, name: 600, bubble: 500, meta: 500,
    },
    mincho: {
      family: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", "MS Mincho", serif',
      title: 700, name: 700, bubble: 600, meta: 600,
    },
  };
  const fontStyle = Object.hasOwn(fonts, state.font) ? fonts[state.font] : fonts.bold;
  const wordSegmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ja', { granularity: 'word' })
    : null;
  const graphemeSegmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
    : null;

  function segments(text, segmenter, fallback) {
    return segmenter
      ? Array.from(segmenter.segment(text), ({ segment }) => segment)
      : fallback(text);
  }

  function paragraphs(text) {
    return text.trim().split(/\r?\n/).map((line) => (
      segments(line.trim(), wordSegmenter, (value) => value.split(/(\s+)/u))
    ));
  }

  function wrappedLines(text, maxWidth) {
    const lines = [];
    for (const words of text) {
      let current = '';
      for (const word of words) {
        const next = current ? current + word : word.trimStart();
        if (ctx.measureText(next.trimEnd()).width <= maxWidth) {
          current = next;
          continue;
        }
        if (current.trim()) lines.push(current.trimEnd());
        current = '';
        if (ctx.measureText(word).width <= maxWidth) {
          current = word.trimStart();
          continue;
        }
        for (const character of segments(word, graphemeSegmenter, Array.from)) {
          if (current && ctx.measureText(current + character).width > maxWidth) {
            lines.push(current.trimEnd());
            current = '';
          }
          current += character;
        }
      }
      lines.push(current.trimEnd());
    }
    return lines;
  }

  function largestLayout(maxSize, layout, availableHeight) {
    let low = 1;
    let high = maxSize;
    let fitted = layout(low);
    while (low <= high) {
      const size = Math.floor((low + high) / 2);
      const candidate = layout(size);
      if (candidate.height <= availableHeight) {
        fitted = candidate;
        low = size + 1;
      } else {
        high = size - 1;
      }
    }
    return fitted;
  }

  function box(x, y, width, height, radii, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radii);
    ctx.fill();
  }

  function label(text, x, y, { size, width, weight, color, align, font = fontStyle.family }) {
    const value = text.trim().replace(/\s+/gu, ' ');
    if (!value) return;
    ctx.font = `${weight} ${size}px ${font}`;
    const measured = ctx.measureText(value).width;
    if (measured > width) {
      const fitted = Math.max(1, Math.floor(size * width / measured));
      ctx.font = `${weight} ${fitted}px ${font}`;
    }
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y, width);
  }

  function drawTitle(availableHeight) {
    const title = paragraphs(state.title);
    const layout = largestLayout(106, (size) => {
      ctx.font = `${fontStyle.title} ${size}px ${fontStyle.family}`;
      const lines = wrappedLines(title, 920);
      const lineHeight = size * 1.08;
      return { size, lines, lineHeight, height: lines.length * lineHeight };
    }, availableHeight);

    ctx.font = `${fontStyle.title} ${layout.size}px ${fontStyle.family}`;
    ctx.fillStyle = '#131417';
    ctx.textAlign = 'left';
    layout.lines.forEach((line, index) => {
      ctx.fillText(line, 118, 88 + layout.lineHeight * (index + 0.5));
    });
  }

  function drawCharacter() {
    const custom = state.characterImage;
    const useCustom = Boolean(custom?.naturalWidth && custom.naturalHeight);
    const artwork = characterArtwork.get(state.character) ?? characterArtwork.get('dog');
    if (!useCustom && !artwork) return { top: 590, right: 966 };

    const image = useCustom ? custom : artwork.image;
    const frame = useCustom
      ? [0, 0, image.naturalWidth, image.naturalHeight]
      : (Object.hasOwn(artwork.frames, state.expression) ? artwork.frames[state.expression] : artwork.frames.cry);
    const [sourceX, sourceY, sourceWidth, sourceHeight] = frame;

    const size = Number.isFinite(state.characterSize)
      ? Math.min(150, Math.max(50, state.characterSize))
      : 100;
    const baseWidth = useCustom ? sourceWidth : artwork.width;
    const baseHeight = useCustom ? sourceHeight : artwork.height;
    const scale = Math.min(896 / baseWidth, 650 / baseHeight) * size / 100;
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const left = Math.max(70, 518 - width / 2);
    const top = 1240 - height;

    ctx.imageSmoothingEnabled = useCustom;
    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, left, top, width, height);
    return { top, right: left + width };
  }

  function drawChat(chatLeft) {
    const chatWidth = 2280 - chatLeft;
    const messageLeft = chatLeft + 40;
    const messageRight = 2240;
    const messageWidth = messageRight - messageLeft;
    ctx.save();
    ctx.shadowBlur = 90;
    ctx.shadowOffsetY = 42;
    ctx.shadowColor = 'rgba(41, 51, 76, 0.16)';
    box(chatLeft, 88, chatWidth, 1180, 44, '#ffffff');
    ctx.restore();

    ctx.fillStyle = '#dce0ea';
    ctx.fillRect(chatLeft, 224, chatWidth, 2);
    box(messageLeft, 118, 76, 76, 38, '#c8cdda');
    label(state.name, chatLeft + 140, 157, {
      size: 44, width: chatWidth - 190, weight: fontStyle.name, color: '#131417', align: 'left',
    });

    const accent = /^#[\da-f]{6}$/i.test(state.accent) ? state.accent : '#2c67f6';
    const channels = [1, 3, 5].map((index) => {
      const channel = Number.parseInt(accent.slice(index, index + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    const bubbleText = luminance > 0.179 ? '#000000' : '#ffffff';
    const messages = state.messages.filter((message) => message.trim()).map((message) => ({
      text: paragraphs(message), incoming: false,
    }));
    if (state.incoming?.trim()) {
      messages.unshift({ text: paragraphs(state.incoming), incoming: true });
    }
    const hasTime = Boolean(state.time.trim());
    const hasStatus = Boolean(state.status.trim());
    const bottom = hasStatus ? 1170 : 1224;

    const layout = largestLayout(40, (size) => {
      const gap = size * 0.5;
      const padX = size * 0.8;
      const padY = size * 0.54;
      const lineHeight = size * 1.22;
      ctx.font = `${fontStyle.bubble} ${size}px ${fontStyle.family}`;
      const bubbles = messages.map(({ text, incoming }) => {
        const lines = wrappedLines(text, messageWidth - 2 * padX);
        const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
        const width = textWidth + 2 * padX;
        const height = lines.length * lineHeight + 2 * padY;
        return { lines, width, height, incoming };
      });
      const height = bubbles.reduce((sum, bubble) => sum + bubble.height, 0)
        + Math.max(0, bubbles.length - 1) * gap;
      return { size, gap, padX, padY, lineHeight, bubbles, height };
    }, bottom - (hasTime ? 320 : 250));

    let y = bottom - layout.height;
    if (hasTime) {
      label(state.time, chatLeft + chatWidth / 2, y - 48, {
        size: 28, width: chatWidth - 130, weight: fontStyle.meta, color: '#777f94', align: 'center',
        font: fontStyle.timestamp,
      });
    }

    ctx.font = `${fontStyle.bubble} ${layout.size}px ${fontStyle.family}`;
    ctx.textAlign = 'left';
    for (const bubble of layout.bubbles) {
      const x = bubble.incoming ? messageLeft : messageRight - bubble.width;
      const radius = Math.min(36, layout.size * 0.9);
      const corner = radius * 0.36;
      const radii = bubble.incoming ? [radius, radius, radius, corner] : [radius, radius, corner, radius];
      box(x, y, bubble.width, bubble.height, radii, bubble.incoming ? '#ebedf2' : accent);
      ctx.fillStyle = bubble.incoming ? '#252836' : bubbleText;
      bubble.lines.forEach((line, index) => {
        const baseline = y + layout.padY + layout.lineHeight * (index + 0.5);
        ctx.fillText(line, x + layout.padX, baseline);
      });
      y += bubble.height + layout.gap;
    }

    if (hasStatus) {
      label(state.status, messageRight, 1208, {
        size: 27, width: messageWidth, weight: fontStyle.meta, color: '#777f94', align: 'right',
      });
    }
  }

  ctx.save();
  ctx.setTransform(canvas.width / 2400, 0, 0, canvas.height / 1350, 0, 0);
  ctx.fillStyle = '#edf0f7';
  ctx.fillRect(0, 0, 2400, 1350);
  ctx.textBaseline = 'middle';
  const art = drawCharacter();
  drawTitle(Math.min(485, art.top - 88 - 17));
  drawChat(Math.max(1160, Math.ceil(art.right + 80)));
  ctx.restore();
}

    const characterChoice = document.querySelector("#character");
    const expressionChoice = document.querySelector("#expression");
    const initialCharacter = randomCharacterAndExpression();
    const initialConversation = randomConversation();
    const example = {
      ...initialCharacter,
      ...initialConversation,
      accent: "#2b64f5",
      font: "bold",
      characterSize: 100
    };
    const maxMessages = 8;
    const canvas = document.querySelector("#meme");
    const messageList = document.querySelector("#messages");
    const addMessage = document.querySelector("#add-message");
    const randomizeCharacter = document.querySelector("#randomize-character");
    const randomizeConversation = document.querySelector("#randomize-conversation");
    const characterFile = document.querySelector("#character-file");
    const removeCharacter = document.querySelector("#remove-character");
    const fileName = document.querySelector("#file-name");
    const download = document.querySelector("#download");
    const share = document.querySelector("#share");
    const accent = document.querySelector("#accent");
    const resetAccent = document.querySelector("#reset-accent");
    const characterSize = document.querySelector("#character-size");
    const characterSizeValue = document.querySelector("#character-size-value");
    const notice = document.querySelector("#notice");
    const pngName = "chat-meme.png";
    const fields = Object.keys(example)
      .filter((key) => key !== "messages" && key !== "characterSize")
      .map((key) => [key, document.getElementById(key)]);

    let state;
    let currentConversation;
    let characterRequest = 0;
    let noticeTimer;
    let frame;

    function randomIndex(count, excluded = -1) {
      const hasExclusion = Number.isInteger(excluded) && excluded >= 0 && excluded < count;
      const pick = Math.floor(Math.random() * (hasExclusion ? count - 1 : count));
      return hasExclusion && pick >= excluded ? pick + 1 : pick;
    }

    function randomConversation() {
      const key = "chat-meme-maker:last-topic";
      let previous = -1;
      try {
        previous = Number(localStorage.getItem(key) ?? -1);
      } catch {
        // Storage can be unavailable when opening the local HTML file.
      }

      const index = randomIndex(conversationTopics.length, previous);
      try {
        localStorage.setItem(key, String(index));
      } catch {
        // The initial conversation still works without browser storage.
      }
      return conversationTopics[index];
    }

    function randomCharacterAndExpression(excludeCurrent = false) {
      const expressionCount = expressionChoice.options.length;
      const combinationCount = characterChoice.options.length * expressionCount;
      const current = excludeCurrent
        ? characterChoice.selectedIndex * expressionCount + expressionChoice.selectedIndex
        : -1;
      const next = randomIndex(combinationCount, current);

      return {
        character: characterChoice.options[Math.floor(next / expressionCount)].value,
        expression: expressionChoice.options[next % expressionCount].value
      };
    }

    function showNotice(message) {
      window.clearTimeout(noticeTimer);
      notice.textContent = message;
      noticeTimer = window.setTimeout(() => { notice.textContent = ""; }, 4500);
    }

    function updatePreview() {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        renderMeme(canvas, state);
      });
    }

    function refreshMessages() {
      messageList.replaceChildren();
      state.messages.forEach((message, index) => {
        const row = document.createElement("div");
        row.className = "message-row";

        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 96;
        input.spellcheck = false;
        input.placeholder = "メッセージ";
        input.value = message;
        input.setAttribute("aria-label", `吹き出し ${index + 1}`);
        input.addEventListener("input", () => {
          state.messages[index] = input.value;
          updatePreview();
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button remove-message";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `吹き出し ${index + 1} を削除`);
        remove.addEventListener("click", () => {
          state.messages.splice(index, 1);
          refreshMessages();
          const nextRow = messageList.children[index] || messageList.lastElementChild;
          (nextRow?.querySelector("input") || addMessage).focus();
          updatePreview();
        });

        row.append(input, remove);
        messageList.append(row);
      });

      addMessage.disabled = state.messages.length >= maxMessages;
    }

    function setCharacterImage(image, name = "") {
      state.characterImage = image;
      characterChoice.disabled = Boolean(image);
      expressionChoice.disabled = Boolean(image);
      randomizeCharacter.disabled = Boolean(image);
      removeCharacter.hidden = !image;
      fileName.hidden = !image;
      fileName.textContent = name;
      updatePreview();
    }

    function updateSizeLabel() {
      const value = `${state.characterSize}%`;
      characterSizeValue.value = value;
      characterSize.setAttribute("aria-valuetext", value);
    }

    function reset() {
      characterRequest += 1;
      characterFile.value = "";
      currentConversation = initialConversation;
      state = { ...example, messages: [...example.messages], characterImage: null };
      fields.forEach(([key, input]) => { input.value = state[key]; });
      characterSize.value = state.characterSize;
      updateSizeLabel();
      resetAccent.disabled = true;
      refreshMessages();
      setCharacterImage(null);
    }

    fields.forEach(([key, input]) => {
      input.addEventListener("input", () => {
        state[key] = input.value;
        if (key === "accent") resetAccent.disabled = input.value === example.accent;
        updatePreview();
      });
    });

    characterSize.addEventListener("input", () => {
      state.characterSize = characterSize.valueAsNumber;
      updateSizeLabel();
      updatePreview();
    });

    randomizeCharacter.addEventListener("click", () => {
      const selection = randomCharacterAndExpression(true);
      characterRequest += 1;
      characterChoice.value = selection.character;
      expressionChoice.value = selection.expression;
      Object.assign(state, selection);
      updatePreview();
    });

    randomizeConversation.addEventListener("click", () => {
      const current = conversationTopics.indexOf(currentConversation);
      const topic = conversationTopics[randomIndex(conversationTopics.length, current)];
      currentConversation = topic;
      Object.assign(state, topic, { messages: [...topic.messages] });
      for (const [key, input] of fields) {
        if (Object.hasOwn(topic, key)) input.value = topic[key];
      }
      refreshMessages();
      updatePreview();
    });

    addMessage.addEventListener("click", () => {
      if (state.messages.length >= maxMessages) return;
      state.messages.push("");
      refreshMessages();
      messageList.lastElementChild.querySelector("input").focus();
      updatePreview();
    });

    characterFile.addEventListener("change", async () => {
      const file = characterFile.files[0];
      characterFile.value = "";
      if (!file) return;
      const request = ++characterRequest;
      if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
        showNotice("PNG・JPEG・WebPの画像を選んでください。");
        return;
      }

      const image = new Image();
      const source = URL.createObjectURL(file);
      try {
        image.src = source;
        await image.decode();
        if (request === characterRequest) setCharacterImage(image, file.name);
      } catch {
        if (request === characterRequest) showNotice("画像を読み込めませんでした。");
      } finally {
        URL.revokeObjectURL(source);
      }
    });

    removeCharacter.addEventListener("click", () => {
      characterRequest += 1;
      setCharacterImage(null);
      characterFile.focus();
    });

    document.getElementById("reset").addEventListener("click", () => {
      reset();
      showNotice("初期状態に戻しました。");
    });

    resetAccent.addEventListener("click", () => {
      state.accent = example.accent;
      accent.value = state.accent;
      resetAccent.disabled = true;
      updatePreview();
    });

    function savePng(blob, message) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pngName;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 15000);
      showNotice(message);
    }

    function downloadPng(message = "PNGを書き出しました。") {
      renderMeme(canvas, state);
      canvas.toBlob((blob) => {
        if (!blob) {
          showNotice("PNGを書き出せませんでした。");
          return;
        }

        savePng(blob, message);
      }, "image/png");
    }

    download.addEventListener("click", () => downloadPng());

    share.addEventListener("click", async () => {
      const attachMessage = "PNGを書き出しました。Xの投稿画面で添付してください。";
      if (!navigator.share || !navigator.canShare) {
        downloadPng(attachMessage);
        return;
      }

      try {
        renderMeme(canvas, state);
        // Build the file within the tap handler so Safari can open the share sheet.
        const encoded = canvas.toDataURL("image/png").split(",")[1];
        const content = atob(encoded);
        const bytes = Uint8Array.from(content, (character) => character.charCodeAt(0));
        const file = new File([bytes], pngName, { type: "image/png" });
        const data = { files: [file] };

        if (!navigator.canShare(data)) {
          savePng(file, attachMessage);
          return;
        }

        await navigator.share(data);
      } catch (error) {
        if (error.name === "AbortError") return;
        showNotice("画像を共有できませんでした。「PNGを保存」から保存できます。");
      }
    });

    reset();
    loadCharacterArtwork()
      .then(() => {
        renderMeme(canvas, state);
        download.disabled = false;
        share.disabled = false;
      })
      .catch(() => {
        showNotice("キャラクター画像を読み込めませんでした。ページを開き直してください。");
      });
