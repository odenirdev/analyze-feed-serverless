# MBRAS Code Challenge

## Descrição
API serverless para analisar um feed de mensagens e gerar métricas de sentimento e anomalias. O serviço expõe um endpoint HTTP para receber a lista de mensagens e a janela de tempo de análise.

## Decisões técnicas
- Para esse teste foi acordado com o Ronaldo a possibilidade de fazer em Node.
- Por ser um caso de uso on demand foi escolhido o tipo de arquitetura Lambda, por sua simplicidade de escalabilidade.
- Para implementação da regra de negócio foi determinada a arquitetura handler + services.

## Instalação e como rodar
Pré-requisitos: Node.js 20+ e npm.

```bash
npm install
```

Para rodar localmente com Serverless Offline:
```bash
npm run offline
```

O serviço sobe em `http://localhost:3000/dev`.

## Docs Swagger (testes manuais)
O arquivo está em `docs/swagger.yaml`.

Sugestão de uso:
1. Importe o arquivo no Swagger Editor ou Postman.
2. Execute uma requisição `POST` para `http://localhost:3000/dev/analyze-feed` com o payload de exemplo do próprio Swagger.

## Rodar testes e coverage
```bash
npm test
```

```bash
npm run test:coverage
```

## Conclusão
A solução prioriza simplicidade de deploy, escalabilidade on demand e organização clara da regra de negócio, permitindo evoluir o projeto com baixo custo operacional.
