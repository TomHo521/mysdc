
const parseQuery = require('./parseFunctions.js');
const {Client } = require('pg')

const client = new Client({
  user: 'Tom1',
  //use this for container to Postgres running on localhost
  //host: 'host.docker.internal',  
  //host: '3.134.118.143',
  host: '18.218.160.4',  //new elastic IP address
  //host: 'localhost',
  database: 'questionandanswer',
  password: 'password',
  port: 6003,
  //use this for container to Postgres running on localhost (bc 5432 is std port)
  //port: 5432,
})

client.connect()



// **** SELF NOTES 1 INDEXING ****//
// Because we need all the answers for a particular question: we index answers by question_id
// CREATE INDEX idx_Answers_question_id ON "Answers" (question_id);

// Because we need all the photos for a particular answer: we index photos by answer_id
// CREATE INDEX idx_photos_answer_id ON photos (answer_id);

// Because we need all the questions for a particular product_id: we index questions by product_id
// CREATE INDEX idx_Questions_product_id ON "Questions" (product_id);

// **** SELF NOTES 2 PAGINATION ****//
// pagination done!  
// there were several pagination schemes or patterns available for use.
// the simplest one, limit offset gets us off the ground quickly but has disadvantages for
// lack of consistency when a user may post a new record into the database.  Moreover, for large
// datasets the "shifting" will greatly increase access times, 754ms for 5 x10^6 offset

// For this reason I chose to use Key-set pagination, which requires an ordering.
// This ordering is a natural result of the use of primary keys, and allows us scalable indexing
// I used this command
// CREATE INDEX n_idx_Questions on "Questions" USING btree (id);
// btree(id) or rather indexing by btree allows us the inequality operator

// with that in mind, pagination can now proceed as follows:
// SELECT * from "Questions" WHERE id > 5 ORDER BY id ASC LIMIT 5;
// this returns the page of results for page 2, count = 5

// **** SELF NOTES 3 ***** 
// building the complex query of joins in such a manner that we can limit the time it takes
// example query used for multi table build, removed pagination of q results

// SELECT "Questions".product_id as question_pid, "Questions".id as question_pk, "Questions".id as question_id, "Questions".body as question_body, "Answers".id as answer_id, "Answers".body as answer_body, photos.url as photo_url from "Questions" 
// LEFT OUTER JOIN "Answers" on "Questions".id = "Answers".question_id 
// LEFT OUTER JOIN photos on "Answers".id = photos.answer_id
// WHERE ("Questions".product_id = 6) ORDER BY "Questions".id



// *********  GET QUESTIONS AND ANSWERS ********* 

// database interaction to add a question into the database
const getQuestions = function(obj_param, callback) {

  let { page, count, product_id } = obj_param;
  let lowerbound = (page - 1) * count;
  let upperbound = page * count;

  console.log(`entered page, ${page} : entered count, ${count}: entered product_id ${product_id}`);

  //for now im opting for getting all data in a single query
  var queryStr = `SELECT "Questions".id as question_id, "Questions".body as question_body, 
                  "Questions".date_written as question_date, "Questions".asker_name as asker_name, "Questions".helpful as question_helpfulness,
                  "Questions".reported as reported, "Answers".id as answer_id, "Answers".body as answer_body, 
                  "Answers".date_written as answer_date, "Answers".answerer_name as answerer_name, "Answers".helpful as answer_helpfulness,
                  photos.id as photo_id, photos.url as photo_url from "Questions" 
                  LEFT OUTER JOIN "Answers" on "Questions".id = "Answers".question_id 
                  LEFT OUTER JOIN photos on "Answers".id = photos.answer_id
                  WHERE ("Questions".product_id = ${product_id})
                  ORDER BY "Questions".id`;

    client.query(queryStr, (err, res) => {
      if (err) {
        callback(err, null);
      }
   
      if (!res.rows[0]) {
        callback(null, {
          product_id: product_id,
          firstresults: res.rows,
          results: [],
        });
      }
      else {
        callback(null, {
          product_id: product_id,
          results: parseQuery.parseGetQuestions(res.rows, lowerbound, upperbound),
        });
      }
    });
};


// database interaction to get all the answers for a particular question
const getAnswers = function(obj_param, callback) {

  let { page, count, question_id } = obj_param;
  let lowerbound = (page - 1) * count;
  let upperbound = page * count;

  console.log(`answer entered page, ${page} : entered count, ${count}, question_id: ${question_id}`);
  
  var queryStr = `SELECT "Answers".id as answer_id, "Answers".body as answer_body, "Answers".date_written as answer_date, "Answers".answerer_name as answerer_name, 
                  "Answers".helpful as answer_helpfulness, photos.id as photo_id, photos.url as photo_url
                  FROM "Answers"
                  LEFT OUTER JOIN photos on "Answers".id = photos.answer_id
                  WHERE ("Answers".question_id = ${question_id})`;

  client.query(queryStr, (err, res) => {
    if (err) {
      console.log('no results for answers');
      callback(err, null);
    }
    if (!res.rows[0]) {
      callback(null, {
        question_id: question_id,
        page: page,
        count: count,
        results: [],
      });
    }
    else {
      callback(null, {
        question_id: question_id,
        page: page,
        count: count,
        results: parseQuery.parseGetAnswers(res.rows, lowerbound, upperbound),
      });
    }
  });
};


// const newQuestion = {
//   product_id: req.body.product_id,
//   body: req.body.question,
//   date_written: req.body.date_written,
//   asker_name: req.body.asker_name,
//   asker_email: req.body.asker_email,
// };

// *********  GET QUESTIONS AND ANSWERS ********* 

// database interaction to add a question into the database
// schema for reference: id,product_id,body,date_written,asker_name,asker_email,reported,helpful
const addQuestion = function(q_obj, callback) {

  let timestamp = new Date();
  
  var queryStr = `INSERT INTO "Questions" (product_id, body, date_written, asker_name, asker_email, reported, helpful)`;
  queryStr += ` VALUES ('${q_obj.product_id}', '${q_obj.body}', '${timestamp.getTime()}', '${q_obj.asker_name}', '${q_obj.asker_email}', ${false}, '${0}')`;

  //console.log('this is the query string: ', queryStr);
  client.query(queryStr, (err, res) => {
    if (err) {
      callback(err, null);
    }
    //console.log('successfully added questin record');
    callback(null, res);
  });

};



// const answerToBePosted = {
//   question_id: req.body.question_id,
//   body: req.body.answer_body,
//   date_written: req.body.date_written,
//   answerer_name: req.body.answerer_name,
//   answerer_email: req.body.answerer_email,
// };


// database interaction to add a question into the database
// schema: id,question_id,body,date_written,answerer_name,answerer_email,reported,helpful
const addAnswer = function(a_obj, callback) {

  let timestamp = new Date();

  var queryStr = `INSERT INTO "Answers" (question_id, body, date_written, answerer_name, answerer_email, reported, helpful)`;
  queryStr += ` VALUES ('${a_obj.question_id}', '${a_obj.body}', '${timestamp.getTime()}', '${a_obj.answerer_name}', '${a_obj.answerer_email}','${false}', '${0}')`;

  // console.log('this is the query string: ', queryStr);
  client.query(queryStr, (err, res) => {
    if (err) {
      callback(err, null);
    }
    callback(null, res);
  });
};


/********** REPORT & HELPFUL QUESTIONS ********/
// database interaction to report question
const reportQuestion = function(question_id, callback) {

  var queryStr = `UPDATE "Questions" SET reported = true WHERE id = ${question_id}`;

  client.query(queryStr, (err, res) => {
    if (err) {
      callback(err, null);
    }
    callback(null, res);
  });

};

// database interaction to nominate question as helpful
const helpfulQuestion = function(question_id, callback) {
  var queryStr = `UPDATE "Questions" SET helpful = helpful + 1 WHERE id = ${question_id}`;

  client.query(queryStr, (err, res) => {
    if (err) {
      callback(err, null);
    }
    callback(null, res);
  });

};



/********** REPORT & HELPFUL ANSWERS ********/
// database interaction to report question
const reportAnswer = function(answer_id, callback) {

  var queryStr = `UPDATE "Answers" SET reported = true WHERE id = ${answer_id}`;

  client.query(queryStr, (err, res) => {
    if (err) {
      callback(err, null);
    }
    callback(null, res);
  });


};

// database interaction to nominate question as helpful
const helpfulAnswer = function(answer_id, callback) {
  var queryStr = `UPDATE "Answers" SET helpful = helpful + 1 WHERE id = ${answer_id}`;

  client.query(queryStr, (err, res) => {
    if (err) {
      callback(err, null);
    }
    callback(null, res);
  });
};



module.exports = {
  addQuestion,
  addAnswer,
  getQuestions,
  getAnswers,
  reportQuestion,
  helpfulQuestion,
  reportAnswer,
  helpfulAnswer,
};





// **** EXCESS TEMPORARY CODE ***

// client.query(`SELECT column_name from information_schema.columns WHERE table_schema ='public' AND table_name = 'Questions'`, (err, res) => {
//   console.log(res.rows)
//   //client.end()
// })