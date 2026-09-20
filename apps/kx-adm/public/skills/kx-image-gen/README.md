# KX image generation skill

This package configures the native GPT `image_gen` skill to use the KX image service.

Before importing it, set the environment variable `IMG_OPEN_AI_KEY` with a key copied from
<https://sub2api.qinjiu8.com/>. Restart the computer after setting it. The key is read at
runtime from `process.env.IMG_OPEN_AI_KEY` and is not included in this package.
