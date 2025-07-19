# Étape 1 : Image Ubuntu
FROM ubuntu:22.04

# Étape 2 : Installation de Node.js et LibreOffice
RUN apt-get update && apt-get install -y \
  curl \
  gnupg2 \
  software-properties-common \
  fonts-dejavu \
  libreoffice \
  libreoffice-writer \
  && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
  && apt-get install -y nodejs \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Étape 3 : Création du dossier de l'application
WORKDIR /usr/src/app

# Étape 4 : Copie des fichiers
COPY . .

# Étape 5 : Installation des dépendances Node.js
RUN npm install

# Étape 6 : Exposition du port (utile pour Render)
EXPOSE 3001

# Étape 7 : Lancement de l’application
CMD ["npm", "start"]
