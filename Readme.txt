database tables
* users
 
  columns
  * id
  *email
  *otp
  *timeStamp


*loggedInUsers
   
   columns
   *id
   *email
   *register_date

*enquire
  
  columns
  *id
  *user_id
  *name VARCHAR,
  *whatsapp_number INTEGER,
  *address VARCHAR,
  *exam_city VARCHAR,
  *exam_center VARCHAR,
  *admit_card_path VARCHAR,
  *FOREIGN KEY (user_id) 

*profileDetails

  columns
    *id VARCHAR PRIMARY KEY NOT NULL,
    *user_id VARCHAR,
    *image_url VARCHAR,
    *name VARCHAR,
    *education_status VARCHAR,
    *about VARCHAR,
    *phone_number INTEGER,
    *address VARCHAR,
    *country VARCHAR,
    *email VARCHAR,
    *insta_profile VARCHAR,
    *twitter_profile VARCHAR,
    *facebook_profile VARCHAR,
    *whatsapp_profile VARCHAR,
    *FOREIGN KEY (user_id)