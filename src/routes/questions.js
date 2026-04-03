const express = require("express")
const router = express.Router();

const questions = require("../data/questions");


// GET api/questions/, /api/questions?keyword=http
router.get("/", (req, res) => {
  const {keyword} = req.query;
  if(!keyword){
    return res.json(questions)
  }

  const filteredQuestions = questions.filter(q => q.keywords.includes(keyword))
  return res.json(filteredQuestions)
})


//  GET api/questions/:questionId
router.get("/:questionId", (req, res)=>{

  const questionId = Number(req.params.questionId)

  const question = questions.find(q=>q.id === questionId)
  if(!question) {
    res.status(404).json({ msg: "Question doesn't exist"})
    res.json(question)
  }

  res.json(question)

})


router.post("/",(req, res)=>{
  const {question, date, answer, keywords} = req.body
  if(!question || !date){
    return res.status(400).json({msg: "question and date are required "})
  }

  const existingIds = questions.map(q => q.id)
  const maxId = Math.max(...existingIds)
  
  const newQuestion = {
    id: questions.length ? maxId + 1: 1,
    question, date,
    keywords: Array.isArray(keywords) ? keywords : []

  }


    questions.push(newQuestion)
    res.status(201).json(newQuestion)
})


//put 

router.put("/:questionId", (req, res)=>{

  const questionId = Number(req.params.questionId)

  const ques = questions.find(q=>q.id === questionId)
  if(!ques) {
    res.status(404).json({ msg: "Question doesn't exist"})
    res.json(ques)
  }

  const {question, date, answer, keywords} = req.body
  if(!question || !date){
    return res.status(400).json({msg: "question and date are required "})
  }

  ques.question = question;
  ques.date = date;
  ques.keywords = Array.isArray(keywords)? keywords : []

  res.json(ques)


})



// Delete

router.delete("/:questionId", (req,res)=>{
  const questionId = Number(req.params.questionId)

  const questionIndex = questions.findIndex(q => q.id === questionId)

  if(questionIndex=== -1){
    res.status(404).json({msg: "Question is not found"})
  }

  const questionDelete = questions.splice(questionIndex, 1)

  res.json({
    msg: "Question deleted successfully",
    question: questionDelete
  })

  
})
module.exports = router