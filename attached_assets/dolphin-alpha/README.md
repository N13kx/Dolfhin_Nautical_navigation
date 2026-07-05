# Dolphin Alpha 0.1

Eerste iPhone-first PWA-prototype voor Dolphin.

## Nu aanwezig
- Mobiele kaartinterface
- Live GPS met hoge nauwkeurigheid
- SOG in knopen
- COG
- GPS-nauwkeurigheid
- Dolphin / Satellite / Hybrid modus
- PWA manifest + eenvoudige service worker
- Provider-onafhankelijke basisstructuur
- Demo-overlay voor toekomstige vaarweg/route-lagen

## Starten
```bash
npm install
npm run dev
```

## Belangrijk
De huidige kaartbronnen zijn alleen voor de technische alpha/proefopstelling.
Voor productie moeten databron, licenties, caching en attribution formeel worden gekozen.

## Volgende architectuurstappen
1. Provider interfaces voor kaartdata
2. Officiële vaarweg/objectdata
3. Bruggen en sluizen
4. Bootprofiel
5. Route graph
6. Community observations
7. Weather/environment providers
8. AI reasoning layer
9. Externe data: Signal K / NMEA / AIS
