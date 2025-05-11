// Création du consommateur Kafka
const consumer = kafka.consumer({ groupId: 'book-author-group' });

// Fonction pour consommer des messages depuis Kafka
const consumeMessages = async (topic) => {
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`Message reçu du topic ${topic}: ${message.value.toString()}`);

      // Traite le message (par exemple, afficher les informations du livre ou de l'auteur)
      const messageData = JSON.parse(message.value.toString());
      console.log('Traitement du message:', messageData);
      // Ici tu peux mettre à jour ou afficher des informations supplémentaires
    },
  });
};

// Consommer les messages des topics 'books_topic' et 'authors_topic'
consumeMessages('books_topic').catch(console.error);
consumeMessages('authors_topic').catch(console.error);
