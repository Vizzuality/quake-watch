let webGL2Available: boolean | undefined;

function canCreateWebGL2Context(): boolean {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return context !== null;
}

export function isWebGL2Available(): boolean {
  webGL2Available ??= canCreateWebGL2Context();
  return webGL2Available;
}
