# Le roi des nains

# IHM
ici le board est bien fait, 
[ça peu donner des idées](https://lh3.googleusercontent.com/PX4KPs_vjhm6L-adH3l1kqTfmKktVv9a4loAu-uQHGWL1dJKYVUUSis-pVaH1mXFkS4=w720-h310-rw)  
https://play.google.com/store/apps/details?id=com.gameduell.mobile.belote  

# Les règles
https://www.jeuxavolonte.asso.fr/regles/le_roi_des_nains.pdf

# Lancer le projet
- `npm install` pour installer le dépendances
- `npm run dev` pour lancer le deamon node en local, qui démarre le serveur node.js (le port est dans le `server.js`)
- `http://localhost:8080/` pour accéder à l'application, qui va ouvrir la page `main.html`

# Technos:
## IHM
SFE: Je propose faire avec flutter/dart, je pense qu'il est bien performant. Une occasion d'aprendre une bonne techno aussi :)  
- From Zero to a Multiplatform Flutter Game in a week: [ici](https://medium.com/flutter-community/from-zero-to-a-multiplatform-flutter-game-in-a-week-8245da931c7e)
- Building a Puzzle Game in Flutter [ici](https://itnext.io/building-a-puzzle-game-in-flutter-41c6c1eee65a)
- flame-engine [ici](https://github.com/flame-engine/flame) : it provides you with:
1. a game loop
2. a component/object system
3. bundles a physics engine (box2d)
4. audio support
5. effects and particles
6. gesture and input support
7. images, sprites and sprite sheets
8. basic Rive support
9. and a few other utilities to make development easier
10. You can use whichever ones you want, as they are all somewhat independent.

