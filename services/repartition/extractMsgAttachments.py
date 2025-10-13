# services/repartition/extractMsgAttachments.py
# Script pour extraire les pièces jointes ZIP d'un fichier .msg
# Usage: python extractMsgAttachments.py <chemin_msg> <dossier_sortie>
import sys
import os
from pathlib import Path
import extract_msg  # pip install extract-msg

def main():
    if len(sys.argv) < 3:
        print("Usage: python extractMsgAttachments.py <chemin_msg> <dossier_sortie>", file=sys.stderr)
        sys.exit(1)

    msg_path = sys.argv[1]
    out_dir = sys.argv[2]

    msg_path = Path(msg_path)
    out_dir = Path(out_dir)

    print(f"Lecture du mail : {msg_path}")
    print(f"Dossier de sortie : {out_dir}")

    if not msg_path.exists():
        print(f"Fichier .msg introuvable : {msg_path}", file=sys.stderr)
        sys.exit(1)

    if not out_dir.exists():
        print(f"Dossier de sortie inexistant, création : {out_dir}")
        out_dir.mkdir(parents=True, exist_ok=True)

    try:
        msg = extract_msg.Message(str(msg_path))
        attachments = msg.attachments

        if not attachments:
            print("Aucun attachement détecté dans le mail.")
            sys.exit(0)

        zip_found = False
        for att in attachments:
            filename = att.longFilename or att.shortFilename or "unknown"
            data = att.data

            print(f"Attachement détecté : {filename}, taille : {len(data) if data else 0} octets")

            # On ne traite que les fichiers ZIP
            if filename.lower().endswith(".zip"):
                zip_found = True
                if data and len(data) > 0:
                    out_path = out_dir / filename
                    with open(out_path, "wb") as f:
                        f.write(data)
                    print(f"Fichier ZIP sauvegardé : {out_path}")
                else:
                    print(f"Le ZIP est vide ou non lisible : {filename}")

        if not zip_found:
            print("Aucun fichier ZIP trouvé dans le mail.")

    except Exception as e:
        print(f"Erreur lors de l'extraction des pièces jointes : {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
