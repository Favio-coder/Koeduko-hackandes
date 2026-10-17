# KoEduko — Guía de integración

## 1. Reglas del equipo

1. **`main` es intocable.** Nadie hace push directo a `main`.
2. **Commits pequeños y descriptivos.**
3. **PR con descripción y criterios de aceptación marcados.**
4. **`npm run lint && npm test && npm run build` verdes antes de pedir revisión.**
5. **No se editan archivos de otro módulo** sin avisar antes.
6. **No push ni merge automáticos.** El arquitecto de merge es una persona.

## 2. Crear tu rama

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b feature/auth-dashboard        # o matching-engine / sessions-ai
git push -u origin feature/auth-dashboard
```

> Las ramas remotas las crea cada uno. No se crean automáticamente.

## 3. Flujo diario

```bash
git fetch origin
git rebase origin/main        # o: git merge origin/main
npm run lint && npm test && npm run build
git add -A
git commit -m "feat(matching): implementa complementarityScore"
```

Formato de mensaje recomendado:

```text
<tipo>(<módulo>): <descripción corta en imperativo>

tipos: feat | fix | refactor | test | docs | chore
módulos: auth | dashboard | assessments | matching | sessions | ai | shared | infra
```

## 4. Antes de abrir el PR

```bash
npm run lint          # 0 errores
npm test              # verde
npm run build         # compila
git diff origin/main --stat
```

En la descripción del PR pega la salida de esos tres comandos. Si algo falla y no
lo puedes resolver, **explícalo explícitamente** en lugar de dejarlo en silencio.

## 5. Puntos de conflicto y quién los resuelve

| Archivo | Conflicto esperado | Responsable |
| --- | --- | --- |
| `package.json` / `package-lock.json` | Versions distintas | Quien instale; **rebasear y re-resolver** |
| `src/app/router.jsx` | Rutas nuevas | Quien añade la ruta, avisando en el canal |
| `src/shared/constants/contracts.js` | Constantes nuevas | ** Siempre requiere acuerdo previo** |
| `firestore.rules` / `firestore.indexes.json` | Reglas nuevas | Quien lo necessite,Coordinate antes |
| `src/components/ui/` | Componente base cambiado | Quien lo modificó explica el cambio |

### Regla de oro

> **Conflicto en un archivo compartido = parar y hablar antes de mergear.**
> No resolver un conflicto de contrato "a ojo". Un cambio silencioso en
> `contracts.js` rompe silenciosamente el módulo de otro desarrollador.

## 6. Resolver un conflicto

```bash
git fetch origin
git rebase origin/main
```

Durante el rebase, Git se detiene en el archivo en conflicto:

```bash
git status                     # ver conflictos
# editar el archivo dejando UNA version correcta
git add <archivo>
git rebase --continue
```

Si el conflicto es insuperable:

```bash
git rebase --abort              # volver al estado anterior
```

### Caso especial: `package-lock.json`

Nunca lo resuelvas a mano.

```bash
git checkout --theirs package-lock.json   # o --ours, según convenga
rm package-lock.json
npm install
git add package-lock.json
git rebase --continue
```

## 7. Orden de integración

```
1. DEV 1 (auth/dashboard)     ← desbloquea: provee students y classrooms
2. DEV 2 (matching-engine)    ← desbloquea: produce pairs confirmadas
3. DEV 3 (sessions/ai)        ← desbloquea: consume pairs
```

Si DEV 3 va más rápido, su PR queda en cola como **draft**. Mergear en otro orden
rompe la demostración del flujo completo.

## 8. Checklist de integración

- [ ] `npm ci` limpio (lock file coherente con `package.json`)
- [ ] `npm run lint` sin errores
- [ ] `npm test` verde
- [ ] `npm run build` correcto
- [ ] Rutas nuevas reflejadas en `src/app/router.jsx`
- [ ] Colecciones nuevas documentadas en `docs/FIRESTORE_SCHEMA.md`
- [ ] Reglas de Firestore actualizadas si tocaste seguridad
- [ ] Sin secretos en el código (`.env` nunca se commitea)
- [ ] `.env.example` actualizado si agregaste variables

## 9. Secretos

```bash
# NUNCA
echo "GEMINI_API_KEY=..." >> .env
git add .env && git commit          # PROHIBIDO

# Correcto
firebase functions:secrets:set GEMINI_API_KEY
```

`.env` está en `.gitignore`. Verificar antes de cada commit:

```bash
git diff --cached --name-only | grep -E '^\.env$' && echo "PELIGRO"
```

## 10. Demo antes de mergear

Antes de la integración final, cada desarrollador demuestra su parte en dev:

```bash
npm run dev
```

- DEV 1: registro → login → dashboard → ruta protegida redirige.
- DEV 2: diagnóstico → perfiles → emparejamiento → confirmación.
- DEV 3: sesión → enlace de Meet → tutor responde.

## 11. Cuando algo falla

No afirmar que algo funciona si no fue probado. Si una integración no está
verificada (por ejemplo Gemini sin desplegar), **decirlo explícitamente** en el PR
y en la entrega. Una demo honesta vale más que una afirmación sin respaldo.