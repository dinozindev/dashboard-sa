# 🔧 Troubleshooting - Shipment Insights Hub

**Última atualização:** 2026-09-09

## 📑 Índice de Problemas

1. [Setup e Instalação](#setup-e-instalação)
2. [Desenvolvimento](#desenvolvimento)
3. [Build e Deploy](#build-e-deploy)
4. [Performance](#performance)
5. [Dados e Integração](#dados-e-integração)
6. [Navegador](#navegador)
7. [FAQs](#faqs)

---

## 🚀 Setup e Instalação

### Problema: `npm install` falha com erro de dependências

**Sintomas:**
```
npm ERR! peer dep missing: react@19
npm ERR! Could not resolve dependency
```

**Solução:**

```bash
# Limpar cache do npm
npm cache clean --force

# Deletar node_modules e package-lock.json
rm -rf node_modules package-lock.json

# Reinstalar com legacy peer deps (último recurso)
npm install --legacy-peer-deps

# Ou atualizar npm
npm install -g npm@latest
npm install
```

---

### Problema: Node version mismatch

**Sintomas:**
```
This version of npm is incompatible with node v14.0.0
Required: node >= 18.0.0
```

**Solução:**

```bash
# Verificar versão do Node
node --version

# Instalar nvm (Node Version Manager)
# Linux/macOS:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Windows: Usar nvm-windows
# https://github.com/coreybutler/nvm-windows/releases

# Instalar Node 20 (recomendado)
nvm install 20
nvm use 20

# Verificar
node --version  # v20.x.x
npm --version   # 9.x.x ou superior
```

---

### Problema: Porta 5173 já em uso

**Sintomas:**
```
Port 5173 is in use. Try --port 3000
```

**Solução:**

```bash
# Opção 1: Usar porta diferente
npm run dev -- --port 3000

# Opção 2: Matar processo na porta 5173
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process

# macOS/Linux
lsof -i :5173 | awk 'NR!=1 {print $2}' | xargs kill

# Opção 3: Reiniciar o PC
```

---

## 💻 Desenvolvimento

### Problema: Mudanças no código não aparecem no navegador

**Sintomas:**
- Arquivo foi modificado
- Navegador não recarrega
- Ou recarrega mas versão antiga aparece

**Solução:**

```bash
# 1. Verificar se Vite está monitorando arquivos
# Se arquivo foi salvo fora do VS Code, Vite pode não detectar

# 2. Force refresh
# Browser: Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)

# 3. Recompilar Vite
# Restart servidor:
npm run dev

# 4. Limpar cache do navegador
# DevTools → Application → Clear storage → Clear site data

# 5. Verificar hot module replacement (HMR)
# Console do navegador: deve ver [vite] connected
```

---

### Problema: Imports falhando com erro "Cannot find module"

**Sintomas:**
```
TypeError: Cannot find module './lib/freight'
```

**Solução:**

```typescript
// ✅ CORRETO: Use alias @ (configurado em vite.config.ts)
import { polygons } from "@/lib/freight/dataset"
import type { PolygonRecord } from "@/lib/freight/types"

// ❌ INCORRETO: Caminhos relativos longos
import { polygons } from "../../../lib/freight/dataset"

// Verificar vite.config.ts tem alias configurado:
// resolve: {
//   alias: {
//     "@": fileURLToPath(new URL("./src", import.meta.url))
//   }
// }
```

---

### Problema: TypeScript erros em componentes

**Sintomas:**
```
Type 'string | null' is not assignable to type 'StoreName'
```

**Solução:**

```typescript
// ❌ INCORRETO: Sem type narrowing
function Component({ id }: { id: string | null }) {
  const store = getStore(id)  // Type error!
}

// ✅ CORRETO: Guard clause
function Component({ id }: { id: string | null }) {
  if (!id) return null
  const store = getStore(id)  // ✅ id é string aqui
}

// ✅ ALTERNATIVA: Type assertion (cuidado!)
function Component({ id }: { id: string | null }) {
  const store = getStore(id!)  // Non-null assertion
}

// Verificar tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

---

### Problema: Mapa Mapbox não carrega

**Sintomas:**
- Mapa em branco
- Erro no console sobre Mapbox token
- Polígonos não aparecem

**Solução:**

```typescript
// 1. Verificar token Mapbox está configurado
// Em FreightMap.tsx:
import mapboxgl from 'mapbox-gl'
mapboxgl.accessToken = 'pk_...'  // Seu token público

// 2. Se token está faltando:
// - Ir para https://account.mapbox.com
// - Copiar token público
// - Adicionar em .env (NÃO comitir para git!)

// 3. Verificar CSS do Mapbox está importado
// Em styles.css ou component:
import 'mapbox-gl/dist/mapbox-gl.css'

// 4. Verificar polígonos estão sendo renderizados
// DevTools → Network → XHR → ver requests GeoJSON
```

---

### Problema: Dados não carregam (freight-data.json)

**Sintomas:**
- Mapa vazio
- Tabelas de tarifa vazias
- Console: undefined is not iterable

**Solução:**

```typescript
// 1. Verificar arquivo existe
// ls src/data/freight-data.json

// 2. Verificar formato JSON é válido
// npm install -g jsonlint
// jsonlint src/data/freight-data.json

// 3. Verificar import é correto
import FreightDatasetRaw from "@/data/freight-data.json"
// Não esquecer 'assert { type: 'json' }' se usar Node.js antigo

// 4. Verificar estrutura de dados
// Console:
FreightDataset.polygons.length  // Deve ser > 0
FreightDataset.tariffs.length   // Deve ser > 0

// 5. Regenerar dados com script
python scripts/build-freight-data.py
```

---

## 🏗️ Build e Deploy

### Problema: Build falha com erro de TypeScript

**Sintomas:**
```
npm run build
error TS2307: Cannot find module '@/types'
```

**Solução:**

```bash
# 1. Verificar tipos estão corretos
npm run lint

# 2. Rebuild tipos
npx tsc --noEmit

# 3. Limpar build e reconstruir
rm -rf dist
npm run build

# 4. Se ainda falhar, forçar build com modo loose
npm run build -- --logLevel=verbose
```

---

### Problema: Build fica muito grande

**Sintomas:**
```
dist/index-abc123.js    1.5MB   (muito grande!)
```

**Solução:**

```bash
# 1. Analisar tamanho de chunks
npm install -D rollup-plugin-visualizer

# Adicionar a vite.config.ts:
import { visualizer } from 'rollup-plugin-visualizer'

export default {
  plugins: [visualizer()]
}

npm run build
# Abre report.html no navegador

# 2. Lazy load componentes pesados
const FreightMap = lazy(() => import('./FreightMap'))

# 3. Usar dynamic imports para libs grandes
const Mapbox = await import('mapbox-gl')

# 4. Tree-shaking: Verificar imports não usados
# ESLint plugin:
npm install -D eslint-plugin-unused-imports
```

---

### Problema: Falha no deploy para Lovable

**Sintomas:**
```
Error: Deploy failed - git history rewritten
```

**Solução:**

```bash
# IMPORTANTE: Não faça force push!
# git push --force  ❌ NUNCA!

# Em vez disso:
git add .
git commit -m "fix: your message"
git push origin main

# Se acidentalmente fez força:
git log  # Verificar commits
git reflog  # Recuperar se necessário
```

---

## ⚡ Performance

### Problema: Dashboard carrega lento

**Sintomas:**
- Página demora >3s para carregar
- Interações lentas (lag)
- Mapa não responde

**Solução:**

```bash
# 1. Profile no DevTools
# Chrome DevTools → Performance → Record
# Identificar bottlenecks

# 2. Verificar lazy loading
# Components/FreightMap devem estar com lazy()

# 3. Memoizar componentes pesados
const FreightMap = memo(function FreightMap(props) { ... })

# 4. Usar Virtual Scrolling para listas
npm install @tanstack/react-virtual

# 5. Reduzir polígonos no GeoJSON
# Se temos 10.000 polígonos, considerar:
# - Simplificar geometria com Mapbox GL Simplify
# - Clusterar por zoom level
# - Carregar dynamicamente por viewport

# 6. Profile memory
# Chrome DevTools → Memory → Heap snapshot
# Procurar memory leaks (listeners não removidos)
```

---

### Problema: Renderização lenta de TariffTable

**Sintomas:**
- Tabela com 100+ linhas demora para renderizar
- Scroll é lento

**Solução:**

```typescript
// ❌ LENTO: Renderiza todas as linhas
function TariffTable({ tariff }: Props) {
  return (
    <table>
      {tariff.map((band, idx) => (
        <tr key={idx}>{/* linha */}</tr>
      ))}
    </table>
  )
}

// ✅ RÁPIDO: Virtual scrolling
import { useVirtualizer } from '@tanstack/react-virtual'

function TariffTable({ tariff }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: tariff.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <table style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <tr key={virtualItem.key} style={{ height: virtualItem.size }}>
            {/* linha */}
          </tr>
        ))}
      </table>
    </div>
  )
}
```

---

## 📊 Dados e Integração

### Problema: Polígonos não aparecem no mapa

**Sintomas:**
- Mapa carrega mas está vazio
- Marcadores de loja aparecem mas polígonos não

**Solução:**

```typescript
// 1. Verificar dados estão carregando
console.log(dataset.polygons.length)  // Deve ser > 0

// 2. Verificar geometria é válida
dataset.polygons.forEach(p => {
  if (!p.geom || p.geom.length === 0) {
    console.warn('Polígono sem geometria:', p.id)
  }
})

// 3. Verificar escala/projeção
// GeoJSON deve estar em [lng, lat] (EPSG:4326)
// Se estiver em [x, y] UTM, convertir

// 4. Verificar se Mapbox source está adicionado
map.on('load', () => {
  map.addSource('polygons', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [...] }
  })
  map.addLayer({
    id: 'polygons-fill',
    type: 'fill',
    source: 'polygons',
    paint: { 'fill-color': '#088', 'fill-opacity': 0.8 }
  })
})

// 5. Verificar bounds do mapa
// Se mapa está zoom demais/pouco, ajustar:
map.fitBounds([[-48, -25], [-45, -22]])  // SP/RJ
```

---

### Problema: Tarifas não calculam corretamente

**Sintomas:**
- Preço mostra valor errado
- Diferença entre loja A e B não condiz

**Solução:**

```typescript
// 1. Verificar WeightBand estão carregadas
console.log(dataset.tariffs)

// 2. Verificar associação polygon ↔ tariff
const polygon = dataset.polygons[0]
const tariff = dataset.tariffs[polygon.tariff]
console.log(polygon.band, tariff)  // Deve estar alinhado

// 3. Verificar fórmula de cálculo
// Não deve ser: amc + peso * pew
// Deve ser: amc + (peso - ws) * pew  (apenas peso extra)

export function calcPrice(weight: number, band: WeightBand): number {
  if (weight < band.ws!) return band.amc!
  const extraWeight = weight - band.ws!
  return band.amc! + extraWeight * band.pew!
}

// 4. Verificar edge cases
// - Peso = 0
// - Peso < Weight_Start
// - Banda sem valores (null)
```

---

### Problema: Lojas e polígonos não estão sincronizados

**Sintomas:**
- Selecionar loja no dropdown não atualiza mapa
- Polígonos de loja diferente aparecem

**Solução:**

```typescript
// 1. Verificar storesInRegion retorna lojas corretas
export function storesInRegion(region: RegionSelection): StoreName[] {
  if (region === 'Todas') return STORE_NAMES
  return STORE_NAMES.filter(s => storeRegion[s] === region)
}

// 2. Verificar filtro de polígonos
const filtered = polygons.filter(p => visibleStores.includes(p.store))

// 3. Verificar useState está atualizado corretamente
// Dashboard.tsx:
const [visibleStores, setVisibleStores] = useState<StoreName[]>([...STORE_NAMES])

// Ao selecionar loja:
setVisibleStores([storeSelection])  // Atualizar state

// 4. Verificar componentes estão re-renderizando
// Adicionar console.log:
function FreightMap({ visibleStores }: Props) {
  console.log('FreightMap re-render com:', visibleStores)
  // Se não aparece, problema é acima (state não está mudando)
}
```

---

## 🌐 Navegador

### Problema: Erro de CORS ao carregar dados

**Sintomas:**
```
Access to XMLHttpRequest... has been blocked by CORS policy
```

**Solução:**

```typescript
// 1. Se dados locais (JSON), não há CORS
// src/data/freight-data.json é importado direto ✅

// 2. Se chamar API externa, configurar CORS
// No backend (Node/Express):
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))

// 3. Se não conseguir CORS, usar proxy
// vite.config.ts:
export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://api.example.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
}

// 4. Se for Mapbox, certificar token é público
mapboxgl.accessToken = 'pk_...'  // ✅ Começa com 'pk_'
```

---

### Problema: LocalStorage/SessionStorage não funciona

**Sintomas:**
```
QuotaExceededError: DOM Exception 22
```

**Solução:**

```typescript
// 1. Verificar se localStorage está habilitado
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('test', 'test')
  localStorage.removeItem('test')
}

// 2. Limpar storage se cheio
localStorage.clear()  // ⚠️ Cuidado: apaga tudo

// 3. Usar sessionStorage em vez de localStorage
// SessionStorage limpa ao fechar aba
sessionStorage.setItem('selection', JSON.stringify(selectedId))

// 4. Se em modo privado/incognito, localStorage é bloqueado
// Usar estado em memória (useState)
const [state, setState] = useState(...)
```

---

## ❓ FAQs

### P: Como adicionar uma nova loja?

**R:** 
1. Adicionar tipo em `src/lib/freight/types.ts`:
   ```typescript
   type StoreName = "Aricanduva" | "Suzano" | "NovaLoja"
   ```
2. Adicionar polígonos no GeoJSON
3. Adicionar em `src/data/freight-data.json` → `stores`
4. Regenerar: `python scripts/build-freight-data.py`

---

### P: Como customizar cores dos polígonos?

**R:**
Editar `src/lib/freight/palette.ts`:
```typescript
export const BAND_COLORS: Record<string, string> = {
  "0-5kg": "#FF0000",      // Vermelho
  "5-10kg": "#00FF00",     // Verde
  "10-20kg": "#0000FF",    // Azul
}
```

---

### P: Como mudar idioma de Inglês para Português?

**R:**
Procurar por `i18n` (internacionalização) no projeto. Se não tiver:
```bash
npm install i18next react-i18next
```

Criar arquivos de tradução em `src/locales/`:
- `pt-BR.json`
- `en-US.json`

---

### P: Como conectar com API externa em vez de JSON local?

**R:**
```typescript
// src/lib/freight/dataset.ts
const FreightDataset = await fetch('/api/freight-data').then(r => r.json())

// Ou com TanStack Query:
import { useQuery } from '@tanstack/react-query'

function useCachedFreightData() {
  return useQuery({
    queryKey: ['freight-data'],
    queryFn: () => fetch('/api/freight-data').then(r => r.json())
  })
}
```

---

### P: Como fazer deploy no Vercel/Netlify?

**R:**
```bash
# Vercel (conecta com GitHub automaticamente)
npm install -g vercel
vercel

# Netlify
npm install -g netlify-cli
netlify deploy --prod --dir dist
```

Ou conectar repositório diretamente na plataforma:
- https://vercel.com/new
- https://app.netlify.com/start

---

### P: Projeto está muito pesado, como otimizar?

**R:**
1. Usar Lighthouse: https://web.dev/measure/
2. Implementar Virtual Scrolling em listas grandes
3. Code splitting com `lazy()` e `Suspense`
4. Minificar assets
5. Usar WebP em vez de PNG/JPG
6. Implementar Service Worker para cache

---

### P: Como debugar componentes no React DevTools?

**R:**
1. Instalar extensão: https://react-devtools-tutorial.vercel.app/
2. Abrir DevTools → Components
3. Inspecionar props, state, hooks
4. Usar "Highlight updates" para ver re-renders

---

Não encontrou sua dúvida? Abra uma issue no GitHub! 📝
