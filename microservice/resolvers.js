const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Configuration des clients gRPC pour Book et Author
const bookProtoPath = path.join(__dirname, 'book.proto');
const authorProtoPath = path.join(__dirname, 'author.proto');

// Configuration du client Book
const bookProtoDefinition = protoLoader.loadSync(bookProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const bookProto = grpc.loadPackageDefinition(bookProtoDefinition).book;
const bookClient = new bookProto.BookService('localhost:50051', grpc.credentials.createInsecure());

// Configuration du client Author
const authorProtoDefinition = protoLoader.loadSync(authorProtoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const authorProto = grpc.loadPackageDefinition(authorProtoDefinition).author;
const authorClient = new authorProto.AuthorService('localhost:50052', grpc.credentials.createInsecure());

// Promisify les appels gRPC
const promisifyGrpcCall = (client, method) => (request) => {
    return new Promise((resolve, reject) => {
        client[method](request, (error, response) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
};

const resolvers = {
    Query: {
        // Résolveurs pour les livres
        book: async (_, { id }) => {
            try {
                const response = await promisifyGrpcCall(bookClient, 'getBook')({ book_id: id });
                return response.book;
            } catch (error) {
                console.error('Erreur lors de la récupération du livre:', error);
                throw new Error('Livre non trouvé');
            }
        },
        books: async (_, { query }) => {
            try {
                const response = await promisifyGrpcCall(bookClient, 'searchBooks')({ query: query || '' });
                return response.books;
            } catch (error) {
                console.error('Erreur lors de la recherche des livres:', error);
                throw new Error('Erreur lors de la recherche des livres');
            }
        },

        // Résolveurs pour les auteurs
        author: async (_, { id }) => {
            try {
                const response = await promisifyGrpcCall(authorClient, 'getAuthor')({ author_id: id });
                return response.author;
            } catch (error) {
                console.error('Erreur lors de la récupération de l\'auteur:', error);
                throw new Error('Auteur non trouvé');
            }
        },
        authors: async (_, { query }) => {
            try {
                const response = await promisifyGrpcCall(authorClient, 'searchAuthors')({ query: query || '' });
                return response.authors;
            } catch (error) {
                console.error('Erreur lors de la recherche des auteurs:', error);
                throw new Error('Erreur lors de la recherche des auteurs');
            }
        }
    },

    Mutation: {
        // Mutation pour ajouter un livre
        addBook: async (_, { book }) => {
            try {
                const response = await promisifyGrpcCall(bookClient, 'addBook')({ book });
                return response.book;
            } catch (error) {
                console.error('Erreur lors de l\'ajout du livre:', error);
                throw new Error('Erreur lors de l\'ajout du livre');
            }
        },

        // Mutation pour ajouter un auteur
        addAuthor: async (_, { author }) => {
            try {
                const response = await promisifyGrpcCall(authorClient, 'addAuthor')({ author });
                return response.author;
            } catch (error) {
                console.error('Erreur lors de l\'ajout de l\'auteur:', error);
                throw new Error('Erreur lors de l\'ajout de l\'auteur');
            }
        }
    }
};

module.exports = resolvers;