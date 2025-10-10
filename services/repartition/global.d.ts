// services/repartition/global.d.ts
// Déclaration de module pour 'msgreader'
// Permet d'utiliser la librairie 'msgreader' sans erreurs de typage TypeScript

declare module 'msgreader' {
  export class MSGReader {
    constructor(buffer: Buffer);
    getFileData(): { subject: string; body: string };
  }
}
