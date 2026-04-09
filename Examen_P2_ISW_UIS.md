# Examen Parcial 2 — Ingeniería de Software

**NOMBRE COMPLETO:** _________________________________ &emsp; **CÓDIGO DE ESTUDIANTE:** _________________

---

## CONTENIDO

Software de verificación aplicando mejores prácticas de Ingeniería de Software, lea muy bien el contenido de este documento y presente una versión finalizada y funcional del mismo, identificando el mayor número de escenarios de aplicación.

---

## EL ESCENARIO

| Campo | Detalle |
|---|---|
| **Participantes** | Cliente y Líder Técnico del Equipo de Desarrollo |
| **Fecha** | 7 de abril de 2026 |
| **Objetivo** | Definición inicial del alcance y requisitos del proyecto |

El proyecto consiste en el desarrollo de un videojuego arcade de acción en 2D inspirado en los clásicos shoot 'em up de naves espaciales. El jugador controlará una nave protagonista que deberá enfrentarse a oleadas progresivas de enemigos alienígenas ("bichos") que aparecerán en patrones cada vez más complejos y desafiantes a medida que avanza en el juego y al avanzar en cada nivel recibirá una recompensa.

La mecánica principal girará en torno al combate espacial donde el jugador deberá disparar proyectiles para eliminar las amenazas enemigas mientras esquiva sus ataques. El juego contará con un sistema de progresión por niveles o fases, donde cada etapa incrementará la dificultad mediante enemigos más resistentes, patrones de ataque más elaborados y mayor velocidad de juego.

El objetivo final será superar todas las oleadas de enemigos estándar para llegar al enfrentamiento culminante contra un "Jefe Final" o boss, que representará el desafío máximo del juego. Este jefe final tendrá características únicas, como mayor resistencia, patrones de ataque especiales y posiblemente múltiples fases de combate que requerirán estrategia y habilidad por parte del jugador.

El juego debe capturar la esencia nostálgica de los arcades clásicos mientras incorpora suficiente profundidad mecánica para mantener el interés del jugador moderno. Se busca crear una experiencia que sea fácil de aprender pero difícil de dominar, con controles responsivos y una curva de dificultad bien balanceada que recompense la práctica y la mejora de habilidades del jugador.

---

## ENTORNO

- **Hardware:** iMac (24-inch, M1, 2021)
- **Sistema Operativo:** Mac OSX Tahoe 16.0.1
- **Memoria:** 8 GB
- **Almacenamiento:** Macintosh HD de 256,11 GB
- **Pantalla:** Retina integrada de 24 pulgadas (4480 × 2520)
- **Entorno de desarrollo:** IntelliJ Idea Ultimate IDE, MS VS Code
- **Navegadores:**
  - Google Chrome Version 140.0.7339.210 (Build official) (x86_64)
  - Safari Versión 26.0.1 (20622.1.22.118.4) — Copyright © 2025 Apple Inc.
- **Servicios:** OneDrive / MS Office 365

---

## REQUISITOS

- Debe funcionar correctamente en: **Google Chrome** y **Safari**.
- El videojuego será un mata-marcianos.
- Manejaremos una **medusa** (que hará de nave espacial) y que disparará verticalmente a los enemigos que le vayan saliendo.
- Los enemigos atacarán a nuestra medusa con disparos. Si un disparo impacta en la medusa morirá (perderá una vida). Si un enemigo colisiona con la medusa también morirá.
- Por cada «bicho» que mate el jugador incrementará su marcador de puntos.
- Si el jugador no mata a un malo, simplemente no sumará los puntos que le corresponderían por hacerlo.
- Nuestro héroe tendrá un **número limitado de vidas**. Cada vez que muera se le restará una vida hasta que se quede sin ninguna.
- Después de que nos ataquen todos los enemigos deberemos matar a un malvado **«Jefe Final»**. Si conseguimos matarlo (o que no nos mate) nos habremos pasado el juego.
- El juego deberá guardar un **histórico con las mejores puntuaciones** del jugador haciendo uso de **Local Storage**.

---

## LOS ACTORES

Pues bien vamos a presentar a los actores de nuestro juego. En primer lugar **«la medusa»**, que será el bueno del juego. Quien tiene que salvar al mundo de las malvadas hordas de bichos que quieren dominarlo.

1. **La Medusa (protagonista):** El jugador manejará a la medusa con las teclas derecha e izquierda para el movimiento y con el espacio para disparar.

2. **El Disparo de la Medusa:** Como hemos dicho, nuestra medusa dispara a los enemigos, por lo que otro actor del juego será el disparo que realice.

3. **Los Enemigos (bichos):** Durante la primera parte del juego, nos atacará una horda de enemigos a los que deberemos destruir o, al menos, evitar que nos destruyan. Los enemigos descenderán verticalmente haciendo un movimiento de zig-zag.

4. **Los Disparos Enemigos:** Al igual que nuestra medusa, los bichos también disparan.

5. **El Jefe Final (boss):** Cualquier mata marcianos que se aprecie debe tener un Malo Final. Nuestro juego no podía ser menos, así que este es nuestro último enemigo.

> La demo de desarrollo se puede descargar desde el aula virtual y desde ella pueden modificar a su preferencia el juego para que corresponda con las especificaciones mencionadas.

---

## DESARROLLO

**(20 pts.)** Primero cree un nombre, un logo y un eslogan para su empresa de desarrollo de software, debe ser impactante y dinámico, esto porque la empresa va a presentar a sus clientes su primer desarrollo y tendrá usted como líder que validar su presentación.

**(20 pts.)** Descargar, correr y probar el videojuego. Para ello usted deberá diseñar y diligenciar un formato de pruebas y validación (creado por usted como ingeniero de software en formación), tenga en cuenta que el videojuego no se ha presentado aún al cliente.

**(20 pts.)** Lea atentamente el entorno, el escenario, los requisitos y los actores, a partir de ellos genere nuevas condiciones de prueba (mejoras) teniendo en cuenta sus recursos al compararlos con los presentados.

**(20 pts.)** Realice las adecuaciones que sean necesarias y pertinentes al videojuego para que cumpla las especificaciones recomendadas o las que usted sugiera construyendo un nuevo documento para realizar la presentación oficial desde su perspectiva como Ingeniero de Software en formación y desde su rol de director general del proyecto.

**(20 pts.)** Presente de manera formal la empresa y la aplicación desarrollada al cliente, tenga en cuenta, el nombre, el logo, el eslogan, la misión, la visión, los valores y principios organizacionales dispuestos para una empresa de desarrollo de videojuegos.

---

**¡ÉXITOS!**
