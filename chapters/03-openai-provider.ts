import { generateText } from '../src/core/generate-text';
import { createOpenAI } from '../src/providers/openai';

const openai = createOpenAI();
const openaiModel = process.env.OPENAI_MODEL_ID ?? 'gpt-5-mini';

const res1 = await generateText({ model: openai(openaiModel), messages: [
  {role: 'user', content: 'TypeScriptの特徴を3つ挙げてください。'}
]  });

console.log(res1.text);
