# Étape 1 : Image de base avec Node.js
FROM node:20-slim

# Étape 2 : Installation de LibreOffice et des polices de base
RUN apt-get update && \
    apt-get install -y libreoffice libreoffice-writer fonts-dejavu fonts-liberation fontconfig && \
    apt-get clean

# Étape 3 : Création du répertoire de l’app
WORKDIR /app

# Étape 4 : Copie du code dans l’image
COPY . .

# Étape 5 : Installation des dépendances
RUN npm install

# Étape 6 : Définition du port (si tu utilises 10000)
EXPOSE 10000

# Étape 7 : Lancement de ton serveur Node.js
CMD ["npm", "start"]
