## Funções:

### Funções customizadas

**Tipos de funções customizadas:**
- **API** - _(End-points de APIs externas)_
- **Banco de dados** - _(Banco de dados locais com IndexedDB)_
- **Script** - _(Snippets de código JavaScript, inseguro)_

### Funções nativas

Ficam listadas separadamente e podem ser desativadas pelo usuário.

- **Busca na web** - _(Google Custom Search JSON API, chave de API necessária)_
- **Geração de imagens** - _(usa modelo do Google, chave de API necessária)_
- **Clima** - _(usa Weather API, chave de API necessária)_

---

## Service Workers

Snippets de código JavaScript que rodam em segundo plano.

### Service Workers customizados:

- Integração a Bancos de lados locais (IndexedDB)

---

## Agentes

Possibilidade de criar perfis de agentes com características, personalidades e funcionalidades diferentes.

Para utilizar o Loox, pelo menos um agente deve existir. O agente padrão é chamado de "Loox".

### Especificações:

**Propriedades:**
- **Nome** - _Nome do agente_
- **Descrição** - _Descrição do agente_
- **Idioma** - _Idioma do agente_
- **Avatar** - _URL de imagem do agente_
- **Funções habilitadas** - _Funções customizadas e nativas_
- **Instruções** - _Mensagem de sistema para o aagente_
- **Personalidade** - _Tom de linguagem, estilo de escrita, etc._
- **Formato de resposta** - _JSON, texto, etc._
  **Conexões** - _Conexões SSH._
- **Agentes recrutáveis** - _Agentes que podem ser recrutados para ajudar este agente_

---

## Conexões

### SSH em servidores

É possível cadastrar conexões SSH em servidores, para que agentes selencionados possam se conectar a eles e executar comandos.

**Propriedades:**
- **Nome** - _Nome da conexão_
- **Host** - _Endereço do servidor_
- **Porta** - _Porta do servidor_
- **Usuário** - _Usuário para autenticação_
- **Senha** - _Senha para autenticação_
- **Chave pública** - _Chave pública para autenticação (opcional)_
- **Chave privada** - _Chave privada para autenticação (opcional)_

---

## Sincronização entre dispositivos

Sincronização de dados do Loox entre múltiplos dispositivos do usuário.

### Funcionamento

- Um perfil Loox é criado no dispositivo do usuário, e uma senha de criptografia é gerada, mas não armazenada. É solicitado ao usuário que armazene essa senha em um local seguro.
- O usuário pode escolher um serviço em núvem para armazenar os dados. As escolhas são:
  - Servidor público Loox (único método disponível no momento)
- Os dados são criptografados com a senha do usuário e enviados para o serviço escolhido a cada 5 minutos, ou manualmente, dependendo da configuração do usuário.
- À partir de outro dispositivo, o usuário pode acessar os dados do Loox, informando a senha de criptografia e o serviço em nuvem escolhido.
- À partir de então, os dados são baixados do serviço em nuvem e descriptografados com a senha do usuário.

---

## Tematização

A interface do Loox pode ser personalizada com temas, que podem ser criados pelo usuário ou selecionados entre os temas nativamente disponíveis.

### Temas customizados
- **Nome** - _Nome do tema_
- **Descrição** - _Descrição do tema_
- **JSON** - _JSON com as propriedades do tema_

### Temas nativos
- **Loox** - _Tema padrão do Loox, escuro_
- **Loox Light** - _Tema claro do Loox_
- **Loox Mega Dark** - _Tema escuro do Loox, com cores mais escuras_
- **Dracula** - _Tema com cores do tema oficial Dracula_

---

## Integrações como Web Component

O Loox pode ser integrado a outras aplicações como um Web Component, permitindo que o usuário utilize o Loox em outras aplicações.

### Funcionamento
- O Loox é integrado a outras aplicações como um Web Component, permitindo que o usuário utilize o Loox em outras aplicações.
- Configurações customizadas são passadas via parâmetros do Web Component, permitindo que o usuário personalize coisas como:
  - Tema
  - Idioma
  - Funções habilitadas
  - Agente padrão

### Exemplo de uso
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loox Web Component</title>

    <script src="https://loox.com.br/loox.js"></script>
    <link rel="stylesheet" href="https://loox.com.br/loox.css">
</head>
<body>
    <loox-web-component
        theme="{ 'primary': '#000', 'secondary': '#fff', ... }"
        language="pt-BR"
        agent="{ 'name': 'Loox', 'description': 'Assistente virtual', ... }"
    ></loox-web-component>

    <script>
        // Inicializa o Loox
        const loox = document.querySelector('loox-web-component');
        loox.init();
    </script>
</body>
</html>
```
