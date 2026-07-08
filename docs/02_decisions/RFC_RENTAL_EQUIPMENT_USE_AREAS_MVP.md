# RFC-RENTAL-EQUIPMENT-USE-AREAS-MVP

**Status:** DECIDIDO — MVP inicial (Clayton 2026-07-07). Substitui o HOLD da nota-premissa anterior.

## Decisão

Equipamentos de locação ganham uma **faceta governada de USO** para navegação/descoberta. Isso **não**
é criar identidade nova nem mexer em N1/N2/CONTEXT — é um mapeamento governado que o backend projeta e
o frontend apenas renderiza.

```
Equipamento   = CONCEPT (identidade, N0 'produtos-e-comercio', uma verdade)
Área de uso    = faceta governada de navegação DENTRO de Locações (many-to-many)
```

## Invariantes (o que esta decisão NÃO faz)

- Não altera N1/N2/CONTEXT (a régua congelada fica intacta).
- Não cria nova identidade semântica — o CONCEPT do equipamento não muda.
- Não muda o N0 (domain) de nenhum concept.
- Um equipamento pode aparecer em **múltiplas** áreas sem duplicar o concept.
- O frontend **não** decide pertinência nem lista áreas/equipamentos localmente. Backend é a fonte.

## Áreas iniciais (vocabulário governado)

| code | label |
|------|-------|
| construction_reform | Construção e reforma |
| cleaning_conservation | Limpeza e conservação |
| gardening_land | Jardinagem e terreno |
| events_parties | Eventos e festas |
| audio_video_lighting | Áudio, vídeo e iluminação |
| energy_support | Energia e apoio |

## Modelo de dados (forward-only)

- `rental_equipment_use_areas` — o vocabulário governado das áreas.
- `rental_equipment_use_area_concepts` — mapeamento many-to-many área↔concept (is_default, sort_order).

## Superfícies

- `GET /rentable-resources/equipment-use-areas` — áreas ativas + contagem de concepts.
- `GET /rentable-resources/concepts?resourceType=equipment&useArea=<code>` — concepts da área (sem
  `useArea` → todos os equipamentos, como hoje).
- Frontend: quando Tipo = Equipamento, campo "Área de uso" (do backend) antes de Categoria; escolher
  área filtra Categoria. Imóvel/Espaço não têm Área de uso.

## Fora do escopo

Bank/ledger, N1/N2/CONTEXT, transformar uso em identidade, lista local no frontend.
