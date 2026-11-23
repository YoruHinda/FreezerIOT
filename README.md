# Freezer Inteligente

Projeto acadêmico de extensão do curso de Ciência da Computação que monitora automaticamente a temperatura de freezers, armazena o histórico das medições e gera alertas quando a temperatura ultrapassa o limite configurado pelo usuário.

A proposta é ser **simples, automático e de baixo custo**: não há LCD, teclado (keypad) nem relé. A configuração e o acompanhamento são feitos inteiramente pelo dashboard web.

## Simulação no Tinkercad

A simulação inicial do circuito (Arduino Uno + sensor TMP36) está disponível em:

https://www.tinkercad.com/things/5cHnz8u3eee-projeto-extensao?sharecode=lH3KOc4sC8tpkqf0Y6gNTVFd0NH-oNvZlGywE_Frkt0

O Tinkercad não simula Wi-Fi e o Arduino Uno não possui Wi-Fi. Por isso, a simulação serve para validar a lógica de leitura de temperatura, e o envio de dados pela internet é feito na versão física com ESP32.

## Como funciona

1. O sensor mede a temperatura do freezer.
2. O ESP32 envia a medição pela internet (Wi-Fi).
3. O ThingSpeak armazena as medições.
4. O dashboard lê os dados do ThingSpeak e mostra a temperatura atual e o histórico.
5. O usuário define o limite máximo de temperatura diretamente no dashboard.
6. O sistema classifica o freezer em **normal**, **atenção** ou **crítico** e exibe os alertas.

```
Sensor DS18B20 -> ESP32 -> ThingSpeak -> Dashboard web
                  (Wi-Fi)   (nuvem)      (leitura + limite + alertas)
```

O ESP32 apenas grava no ThingSpeak e o dashboard apenas lê de lá. Os dois não se comunicam diretamente. O limite de temperatura fica guardado no dashboard e é comparado com cada leitura recebida.

## Tecnologias

| Etapa | Tecnologia |
| --- | --- |
| Simulação do circuito | Tinkercad |
| Simulação inicial | Arduino Uno + sensor TMP36 |
| Versão física | ESP32 + sensor DS18B20 (com Wi-Fi) |
| Armazenamento dos dados | ThingSpeak |
| Dashboard | HTML, CSS e JavaScript |
| API própria (possibilidade futura) | Spring Boot e PostgreSQL |

## Hardware (versão física)

- 1 placa ESP32 (ESP32 Dev Module)
- 1 sensor de temperatura DS18B20 (recomendado em versão à prova d'água para uso em freezer)
- 1 resistor de 4,7 kΩ
- Protoboard e jumpers
- Fonte USB de 5 V

### Ligações

| DS18B20 | ESP32 |
| --- | --- |
| VDD (vermelho) | 3V3 |
| GND (preto) | GND |
| DATA (amarelo) | GPIO 4 |

O resistor de 4,7 kΩ deve ficar entre o pino DATA e o 3V3 (pull-up).

## Firmware do ESP32

O código está no arquivo `freezer_inteligente_esp32.ino`.

- Lê a temperatura do DS18B20.
- Envia o valor ao ThingSpeak (campo `field1`) a cada 20 segundos. O plano gratuito do ThingSpeak exige no mínimo 15 segundos entre envios.
- Reconecta ao Wi-Fi automaticamente se a conexão cair.
- Descarta leituras inválidas, como sensor desconectado, para que valores como -127 °C não cheguem ao dashboard.

### Bibliotecas necessárias

Instale pelo Gerenciador de Bibliotecas da Arduino IDE:

- OneWire (Paul Stoffregen)
- DallasTemperature (Miles Burton)

Instale também o pacote de placas **esp32 by Espressif Systems** e selecione a placa **ESP32 Dev Module**.

### Configuração do firmware

No início do arquivo `.ino`, ajuste:

- o nome e a senha da rede Wi-Fi;
- a Write API Key do canal do ThingSpeak.

Depois grave na placa e abra o Monitor Serial a 115200 baud. Ao iniciar, ele mostra quantos sensores DS18B20 foram encontrados e, a cada envio, a temperatura e a resposta do ThingSpeak.

## ThingSpeak

1. Crie uma conta e um canal no ThingSpeak.
2. Ative o `Field 1` e nomeie como "Temperatura".
3. Copie a Write API Key (usada no ESP32) e o Channel ID (usado no dashboard).
4. Deixe o canal público, ou use a Read API Key no dashboard se o canal for privado.

A Write API Key nunca deve ser colocada no código do dashboard, apenas no firmware do ESP32.

Os dados podem ser lidos por esta forma de URL:

```
https://api.thingspeak.com/channels/<ID_DO_CANAL>/fields/1.json?results=50
```

## Dashboard

O dashboard é feito em HTML, CSS e JavaScript e apresenta:

- temperatura atual;
- limite máximo configurável pelo usuário;
- status do freezer (normal, atenção ou crítico);
- gráfico com o histórico de temperatura;
- alertas recentes.

Atualmente o protótipo utiliza dados simulados. A integração com o ThingSpeak consiste em substituir a fonte de dados simulada por uma requisição `fetch` à API do ThingSpeak, atualizada a cada 20 segundos, o mesmo intervalo de envio do ESP32.

## Estados do freezer

O status é calculado comparando a temperatura atual com o limite definido pelo usuário:

| Estado | Significado |
| --- | --- |
| Normal | Temperatura dentro do limite |
| Atenção | Temperatura próxima do limite |
| Crítico | Temperatura acima do limite |

## Etapas do projeto

- [x] Simulação do circuito no Tinkercad (Arduino Uno + TMP36)
- [x] Protótipo do dashboard com dados simulados
- [x] Firmware do ESP32 com DS18B20 e envio ao ThingSpeak
- [ ] Integração do dashboard com o ThingSpeak
- [ ] Testes com o sensor real em um freezer
- [ ] API própria com Spring Boot e PostgreSQL (possibilidade futura)

## Estrutura do repositório

```
.
├── README.md
├── freezer_inteligente_esp32.ino   # firmware do ESP32
└── dashboard/                      # HTML, CSS e JavaScript do dashboard
```

## Contexto acadêmico

Projeto desenvolvido como atividade de extensão do curso de Ciência da Computação, com foco em soluções acessíveis de monitoramento de temperatura para conservação de alimentos e materiais sensíveis.