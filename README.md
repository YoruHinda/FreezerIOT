# Freezer Inteligente

Sistema IoT para monitoramento da temperatura de freezers, com visualização local e remota, histórico de medições e alertas.

## Objetivo

Acompanhar a temperatura de um freezer e sinalizar quando ela ultrapassar o limite configurado. A proposta é apoiar pequenos estabelecimentos que precisam monitorar produtos refrigerados ou congelados. O sistema monitora e alerta; **não controla o compressor**.

## Arquitetura

```text
DS18B20 → ESP32 → Wi-Fi → ThingSpeak → Dashboard web
             ↑                         |
       LCD 16x2 + Keypad 4x4 ←─────────┘
```

## Componentes previstos

- ESP32 DevKit V1: processamento e conexão Wi-Fi.
- Sensor DS18B20 impermeável: medição de temperatura.
- LCD 16x2 I2C: temperatura, limite e estado local.
- Keypad 4x4: alteração manual do limite.
- Resistor 4,7 kΩ: pull-up do barramento One-Wire.
- Fonte USB 5 V, placa perfurada, fios, conectores e caixa de proteção.

## Funcionamento

1. O DS18B20 mede a temperatura.
2. O ESP32 compara a leitura com o limite salvo.
3. O LCD apresenta temperatura, limite e estado.
4. O keypad permite alterar o limite localmente.
5. O ESP32 envia os dados ao ThingSpeak.
6. O dashboard consulta o canal e mostra indicadores, histórico e alertas.
7. O dashboard pode enviar uma solicitação remota de alteração do limite; o ESP32 deve consultar, aplicar e confirmar o valor.

### Estados do protótipo

- **Normal:** temperatura menor ou igual ao limite.
- **Atenção:** temperatura acima do limite, até 2 °C acima.
- **Crítico:** temperatura acima do limite + 2 °C.

Os limites são parâmetros iniciais do protótipo e devem ser definidos conforme o produto armazenado e os procedimentos do estabelecimento.

## Campos ThingSpeak

| Campo | Nome | Conteúdo |
|---|---|---|
| Field 1 | Temperatura | Leitura em °C |
| Field 2 | Limite | Limite aplicado no ESP32 |
| Field 3 | Status | 1 normal, 2 atenção, 3 crítico |
| Field 4 | Limite remoto | Solicitação enviada pelo dashboard |

O Field 2 representa o limite confirmado no equipamento; o Field 4 transporta a solicitação remota. A sincronização precisa ser testada com o canal real para garantir que uma telemetria não apague um comando ainda não processado.

## Ferramentas e tecnologias da prototipação

- **Wokwi:** simulação da arquitetura atual com ESP32 e periféricos.
- **Tinkercad Circuits:** exploração inicial de circuitos com Arduino, antes da migração para ESP32.
- **ThingSpeak:** armazenamento e troca de dados via API.
- **HTML:** estrutura do dashboard.
- **CSS:** aparência e responsividade.
- **JavaScript:** leitura/escrita da API, atualização de indicadores, gráfico e alertas.
- **Arduino Core para ESP32:** firmware.
- **Bibliotecas:** WiFi, HTTPClient, OneWire, DallasTemperature, Keypad, Wire, LiquidCrystal_I2C, Preferences e ArduinoJson.

## Como executar

### ThingSpeak
Crie um canal chamado **Freezer Inteligente** com os quatro campos da tabela. Copie Channel ID, Read API Key (se privado) e Write API Key.

### Firmware
Abra `sketch.ino` no Wokwi ou ambiente compatível com Arduino-ESP32. Configure Wi-Fi e credenciais ThingSpeak. Instale as bibliotecas externas listadas em `libraries.txt`.

### Dashboard
Mantenha `index.html`, `style.css` e `script.js` na mesma pasta. No início de `script.js`, configure:

```javascript
const CHANNEL_ID = "SEU_CHANNEL_ID";
const READ_API_KEY = ""; // vazio para canal público
const WRITE_API_KEY = "SUA_WRITE_API_KEY";
```

A Write API Key inserida no JavaScript fica visível aos visitantes. Isso serve apenas para prototipação. Em produção, use backend para proteger a chave.

## Situação e limitações

O firmware, a interface e a arquitetura de comunicação foram preparados para prototipação. A integração ponta a ponta deve ser validada com o canal ThingSpeak efetivo e, depois, com hardware físico. Não considerar o projeto pronto para operação comercial antes de testes prolongados, comparação com instrumento de referência, avaliação de confiabilidade e verificação das exigências aplicáveis.

O protótipo não possui relé, não aciona o compressor e não substitui termômetro de referência nem procedimentos de segurança do estabelecimento.

## Cuidados de instalação

- Não conectar o ESP32 à alimentação do compressor.
- Utilizar fonte USB certificada.
- Proteger a eletrônica contra condensação e respingos.
- Fixar a sonda sem danificar a vedação do freezer.
- Verificar a tensão do barramento I2C: GPIOs do ESP32 trabalham com 3,3 V e não devem receber 5 V. Se necessário, usar conversor de nível lógico.
- Para uso comercial, verificar a licença ThingSpeak; a modalidade gratuita é destinada a projetos não comerciais.

## Estrutura

```text
Freezer-Inteligente/
├── sketch.ino
├── libraries.txt
└── dashboard/
    ├── index.html
    ├── style.css
    └── script.js
```