# Portfólio — Luiz Henrique

Portfólio pessoal de desenvolvimento: back-end, front-end, automações e banco de dados.
Site estático (HTML, CSS e JavaScript puro), sem build, publicado no GitHub Pages.

**Online:** https://henrlz.github.io/portfolio-luiz-henrique/

## O que tem no site

- Seções: início, sobre, habilidades, histórico, projetos e contato.
- Tema claro/escuro (preferência salva no navegador).
- Três idiomas, com troca em tempo real (`js/i18n.js`).
- Prévia interativa de cada projeto (`js/previa.js`, `css/palco.css`).
- Navegação acessível (`aria-label`, foco, `prefers-reduced-motion`).

## Projetos

| Projeto | Tipo | Stack |
|---|---|---|
| Toque Gourmet Especial | Freelance | HTML, CSS, JS, Firebase Auth, Firestore, Vercel Functions, Supabase Storage |
| Emissão de Contas a Receber | Profissional (demo, dados fictícios) | React, TypeScript, Vite, TanStack Query, Supabase |
| Prato Certo | Pessoal | HTML, CSS, JS, Open Food Facts API, Tesseract.js (OCR), LocalStorage, cookies |
| FiscalView, Cedro Decor, Consultório, Nosso Sim, Traço, Qual bico?, Margem, Taquígrafo | Pessoais | Ver `ferramentas/` |
| Aprovação de Tarefas no Planner, Automação de Estoque no Omie | Power Automate | Power Automate, Omie |

Os projetos pessoais publicados ficam em `ferramentas/<nome>/` e abrem direto pelo portfólio.
Alguns são aplicações React já compiladas (só o resultado, sem o código-fonte).
O Prato Certo (contador de calorias e nutrientes) tem conta local com questionário guiado e filtro de alimentos pelo perfil de saúde; o botão "Continuar com Google" é só ilustrativo. Ele lê a foto da tabela nutricional por OCR no próprio navegador e usa valores aproximados para itens de redes de fast food: o app avisa isso.
O painel do Cedro Decor é uma demonstração: o login é simbólico e os dados ficam no `localStorage`.

## Estrutura

```
index.html        página única
css/style.css     estilos gerais e temas
css/palco.css     estilos da prévia de projetos
js/script.js      tema, menu, animações
js/i18n.js        traduções (pt, en, es)
js/previa.js      prévia interativa dos projetos
assets/           foto e miniaturas das prévias
ferramentas/      mini-apps e demos publicados
```

## Rodar localmente

```
python -m http.server 8000
```

Abra http://localhost:8000.

## Contato

[GitHub](https://github.com/Henrlz) · [LinkedIn](https://www.linkedin.com/in/luiz-henrique-pereira-077226315) · [Instagram](https://www.instagram.com/henrlzdev)
