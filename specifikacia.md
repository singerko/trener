# Špecifikácia Aplikácie "Tréner" (AI Powered)

Tento dokument definuje požiadavky a špecifikáciu pre mobilnú aplikáciu "Tréner", ktorá slúži ako inteligentný hlasový asistent pre cvičenie. Aplikácia je navrhnutá ako offline-first riešenie využívajúce moderné webové technológie zabalené do natívnej aplikácie.

## 1. Prehľad a Ciele
Cieľom aplikácie je poskytnúť používateľovi zážitok virtuálneho trénera, ktorý ho sprevádza celým tréningom pomocou hlasových pokynov a dokáže počúvať používateľove povely (počítanie opakovaní, potvrdzovanie sérií) bez nutnosti dotýkať sa obrazovky.

**Hlavné vlastnosti:**
- Hlasové ovládanie (rozpoznávanie reči offline).
- Hlasová spätná väzba (TTS).
- Flexibilné tréningové plány (bloky, opakovania).
- Detailná história cvičení.

## 2. Technický Stack
Aplikácia musí byť postavená na nasledujúcich technológiách:
- **Jadro:** React 19 + TypeScript + Vite.
- **Natívny obal:** Capacitor (Android).
- **UI:** TailwindCSS + Lucide React.
- **State Management:** Zustand (pre globálny stav aplikácie a tréningu).
- **AI / Hlas:** 
    - `vosk-speech-recognition-capacitor` (Offline rozpoznávanie reči).
    - `@capacitor-community/text-to-speech` (Hlasový výstup).
- **Dáta:** Lokálne úložisko (LocalStorage / Filesystem), `date-fns` pre prácu s časom.

## 3. Dátový Model

### 3.1 Základné entity
*   **Cvik (Exercise):** Základná jednotka. Obsahuje ID, názov a popis.
*   **Tréningový Plán (WorkoutPlan):** Obsahuje zoznam blokov (SetBlock).
*   **Blok (SetBlock):** Skupina cvikov, ktorá sa môže cyklicky opakovať (napr. kruhový tréning). Má atribút `opakovania` (koľkokrát sa blok zopakuje).
*   **Položka Sériie (SetItem):** Konkrétny cvik v bloku. Definuje typ (počtový/časový) a cieľ (počet opakovaní alebo sekundy).

### 3.2 História a Logy
*   **Tréningová Relácia (WorkoutSession):** Záznam o celom odcvičenom tréningu.
*   **Záznam Cviku (ExerciseLog):** Detail vykonania jedného cviku v sérii. Obsahuje čas, počet dosiahnutých opakovaní a zoznam udalostí (kedy bolo započítané opakovanie).

### 3.3 Merania
*   **Definícia merania (MeasurementDefinition):** Konfigurácia sledovanej hodnoty. Obsahuje názov, jednotku, merané položky a poznámkové presety s farbou.
*   **Položka merania (MeasurementField):** Jedna časť merania, napríklad `pod kolenom`, `horný tlak` alebo `hmotnosť`.
*   **Poznámkový preset (MeasurementNotePreset):** Text poznámky a jej farba v rámci jednej definície merania. Rovnaký text poznámky môže mať v rôznych meraniach inú farbu.
*   **Záznam merania (MeasurementEntry):** Konkrétny záznam hodnôt v čase. Ukladá hodnoty podľa ID položiek a text poznámky. Farba sa vyhodnocuje aktuálne z definície merania, aby zmena farby spätne prefarbila historické body.

### 3.4 Nastavenia (Settings)
*   **Téma (Theme):** Voľba vzhľadu aplikácie: `LIGHT`, `DARK` alebo `SYSTEM` (podľa OS).
*   **Hlasové ovládanie:** Povolenie/zákaz počúvania príkazov.
*   **TTS:** Povolenie/zákaz hlasovej odozvy.

## 4. Funkčné Požiadavky

### 4.1 Správa Tréningov (Plan Editor)
- Používateľ musí mať možnosť vytvoriť a upraviť tréningový plán.
- Možnosť pridávať bloky cvikov a definovať počet ich opakovaní (sérií).
- V rámci bloku pridávať konkrétne cviky z knižnice.
- Nastaviť cieľový počet opakovaní alebo čas trvania pre každý cvik.

### 4.2 Knižnica Cvikov (Exercise Library)
- Zoznam dostupných cvikov.
- Možnosť pridať nový cvik alebo zmazať existujúci.

### 4.3 Živý Tréning (Live Workout) - AI Core
Toto je jadro aplikácie. Režim "Live Workout" musí zabezpečiť:
- **Interaktívny priebeh:** Aplikácia číta názov cviku a inštrukcie.
- **Rozpoznávanie hlasu (Vosk):**
    - Aplikácia musí počúvať číselné povely (počítanie opakovaní používateľom).
    - Povel pre ukončenie série (napr. "ďalej", "hotovo").
    - Povel pre pauzu/pokračovanie.
- **Text-to-Speech (TTS):** 
    - Ohlasovanie začiatku cviku, odpočítavanie času, motivácia, potvrdenie ukončenia série.
- **Logovanie:** Automatické zaznamenávanie času a počtu opakovaní na základe hlasových vstupov.
- **Wake Lock:** Zabránenie zhasnutiu obrazovky počas cvičenia.

### 4.4 História a Progres
- Zobrazenie kalendára alebo zoznamu minulých tréningov.
- Detailný pohľad na tréning (trvanie, odcvičené cviky, počty opakovaní, **použitá váha**).
- Zobrazenie rehabilitácií a meraní v kalendári histórie.
- **Sledovanie progresu:**
    - Možnosť zobrazenia histórie výkonov pre konkrétny cvik (graf alebo zoznam).
    - Vizualizácia zlepšenia (nárast váhy, opakovaní alebo času).

### 4.5 Merania
- Používateľ musí vedieť vytvoriť viac konfigurácií meraní, napríklad opuch nohy, tlak alebo hmotnosť.
- Každá konfigurácia obsahuje jednotku a jednu alebo viac meraných položiek.
- Používateľ musí vedieť počas dňa pridať viac záznamov s dátumom, časom, hodnotami a poznámkou.
- Poznámky sa majú ponúkať podľa predchádzajúcich poznámok v danom meraní.
- Ku každej poznámke v rámci konkrétneho merania sa dá priradiť farba.
- Graf merania zobrazuje body farbou aktuálne priradenou k poznámke.
- Detail merania podporuje rozsahy 1 deň, 1 týždeň, 1 mesiac, 6 mesiacov a 1 rok.
- Pri meraní s viacerými položkami sa zobrazí samostatný graf pre každú položku.

### 4.6 Rozšírené možnosti tréningu
- **Doplnková záťaž (Váha):**
    - Možnosť definovať váhu (kg) pre každý cvik v tréningovom pláne (okrem cieľového počtu/času).
    - Táto hodnota sa musí **uložiť do histórie** v momente tréningu (snapshot), aby neskoršie úpravy plánu neovplyvnili historické záznamy.
- **Zmena poradia cvikov:**
    - V editore plánu musí byť možnosť meniť poradie cvikov v rámci bloku (drag & drop alebo šípky).

## 5. UI/UX Požiadavky
- **Téma (Theme):** Aplikácia musí podporovať **Svetlý (Light)** aj **Tmavý (Dark)** režim.
    - **Konfigurácia:** V nastaveniach musí byť prepínač s možnosťami: *Svetlý*, *Tmavý*, *Systémový*.
    - **Tmavý režim:** Optimalizovaný pre použitie v posilňovni (low-light prostredie).
- **Veľké prvky:** V režime Live Workout musia byť tlačidlá a texty dostatočne veľké pre ovládanie spotenými rukami alebo čitateľnosť z diaľky.
- **Vizuálna spätná väzba:** Indikácia, že aplikácia "počúva" (napr. pulzujúci mikrofón).

## 6. Špecifiká Implementácie
- **Offline First:** Aplikácia musí byť plne funkčná bez internetu (vrátane rozpoznávania reči - preto Vosk).
- **Vosk Model:** Nutnosť pribaliť a načítať ľahký jazykový model pre rozpoznávanie (napr. vosk-model-small-sk alebo en).
