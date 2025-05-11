const { gql } = require('@apollo/server');

const typeDefs = `#graphql
  type Book {
    id: ID!
    title: String!
    author: String!
    description: String
  }

  type Author {
    id: ID!
    name: String!
    bio: String
  }

  type Query {
    books(query: String): [Book]
    book(id: ID!): Book
    authors(query: String): [Author]
    author(id: ID!): Author
  }

  type Mutation {
    addBook(title: String!, author: String!, description: String): Book!
    addAuthor(name: String!, bio: String): Author!
  }
`;

module.exports = typeDefs;