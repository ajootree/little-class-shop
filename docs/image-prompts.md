# 실제 이미지 제작 기록

생성 방식: Codex 내장 `image_gen.imagegen`. CLI 또는 별도 API 키를 사용하지 않았다. 생성한 원본 PNG를 프로젝트에 복사했으며 도형으로 대체하지 않았다. 투명 배경을 요청했고 원본 알파 채널을 유지한다. 글자와 포인트는 이미지에 넣지 않고 웹앱에서 표시한다.

## 상점 그림

파일: `dist/assets/shopfront.png`

실제 호출 프롬프트:

> Use case: illustration-story. Production PNG asset for a Korean elementary classroom reward shop web app. A single delightful hand painted storefront vignette, wide landscape composition, isolated on a genuinely transparent background. Cozy small pastel stationery shop with a cream bunny shopkeeper leaning from the right window, rosy cheeks, gentle tiny dot eyes, lavender apron. Scalloped dusty pink and ivory striped canvas awning, little hanging flowers, paper bunting, cream wooden signboard in center LEFT intentionally completely blank so editable Korean title will be overlaid as HTML. Signboard must be a large empty light cream area roughly occupying the center left third. Bottom shop counter with a few tiny notebooks, a flower pot and a glass jar of star coins. Style: matte gouache and colored-pencil children's picture book, visible subtle paper grain IN the painted shapes, warm muted cream, pastel lilac, blush pink, butter yellow and sage. Friendly and sophisticated kawaii stationery illustration. NOT CSS/vector geometry, not 3D glossy, no harsh black outline. Entire roof and bunny ears inside canvas, generous transparent margins around silhouette. No text, no letters, no watermark, no gradients in the transparent background. This is the real visual asset, not a website screenshot.

## 상품 그림 아틀라스

파일: `dist/assets/products.png`

실제 호출 프롬프트:

> Use case: illustration-story. A production game UI asset atlas PNG, genuinely transparent background. Square canvas divided invisibly into exactly 2 by 2 equal cells. Four separate isolated hand-painted kawaii stationery reward objects centered in their respective cells, with generous empty transparent space so each quadrant can be displayed independently. TOP LEFT: a cute pink and cream rectangular eraser with tiny dot eyes and a gentle smile, a small lavender ribbon. TOP RIGHT: a cream paper music ticket with lavender headphones on it, tiny musical note symbols, no words or letters. BOTTOM LEFT: a little pack of colorful science stickers, a smiling yellow star, pink heart, sage green planet and little flask, arranged as one neat bundle. BOTTOM RIGHT: a cream envelope with a pink heart seal and a tiny lavender flower, letter peeking out with no writing. Match a matte pastel gouache and colored pencil children's picture-book shop: muted blush pink, lavender, butter yellow, cream, sage green; subtle painted paper texture, soft organic contours. No border between cells, no grid lines, no shadows stretching into other cells, no typography, no numbers, no watermark, not glossy plastic and not geometric vector icons. Each object entirely inside its own quadrant; no overlapping cells. All background pixels outside the four objects must be transparent.
