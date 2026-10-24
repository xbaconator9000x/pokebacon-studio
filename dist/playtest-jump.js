// Map jumping depends on unsupported engine-specific layouts and is intentionally disabled
// in the public build. The playtester always starts from the ROM title screen.
export const JUMP_SOURCE=null;
export function jumpReady(){return false;}
export async function jumpToMap(){throw Error('Map jumping is unavailable for this ROM. Start from its title screen.');}
