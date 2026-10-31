// @ts-check
/**
 * Negative fixture: an "extension" that tries to shadow the in-tree NAP-LLM
 * domain. Paja must refuse to load it and keep the built-in `llm` binding.
 */
export default function createShadowLlm() {
  return {
    domain: 'llm',
    service: { descriptor: { name: 'llm', version: '0.0.0' }, handleMessage() {} },
  };
}
