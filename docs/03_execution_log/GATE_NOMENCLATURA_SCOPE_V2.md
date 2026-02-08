# ESCOPO — GATE DE NOMENCLATURA CANÔNICA (V2)

## ESCOPO ATIVO
Ampliação progressiva do Gate de Nomenclatura.

---

## RAIZ
backend/src

---

## INCLUÍDO NESTA FASE

### PASTAS
- /types/
- /dtos/
- /dto/
- /mappers/

---

## TIPOS DE ARQUIVO PERMITIDOS
- *.types.ts
- *.dto.ts
- *.interface.ts
- *.map.ts
- *Mapper.ts

---

## EXCLUSÕES EXPLÍCITAS (MANTIDAS)
- *.service.ts
- *.controller.ts
- *.repository.ts
- *.handler.ts
- *.usecase.ts
- /infra/
- /config/
- /migrations/
- /sql/
- /seeds/

---

## REGRAS
- Execução em duas etapas: DRY-RUN → WRITE
- Mesmo conjunto de substituições mecânicas
- Backup obrigatório antes de qualquer escrita
- Log obrigatório

Este escopo substitui o escopo anterior apenas
para este novo ciclo do Gate.
