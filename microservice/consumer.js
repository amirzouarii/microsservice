// Création du consommateur Kafka
const consumer = kafka.consumer({ groupId: 'book-author-group' });

// Fonction pour consommer des messages depuis Kafka
const consumeMessages = async (topic) => {
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`Message reçu du topic ${topic}: ${message.value.toString()}`);

      // Traite le message 
      const messageData = JSON.parse(message.value.toString());
      console.log('Traitement du message:', messageData);
    },
  });
};

// Consommer les messages des topics 'books_topic' et 'authors_topic'
consumeMessages('books_topic').catch(console.error);
consumeMessages('authors_topic').catch(console.error);
