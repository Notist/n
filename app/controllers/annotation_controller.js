import Annotation from '../models/annotation';

export const createAnnotation = (user, body) => {
  const annotation = new Annotation();
  annotation.authorId = user._id;
  annotation.text = body.text;
  if (body.parentId) {
    return Annotation.findById(body.parentId)
      .then(parent => {
        // inherit properties from parent
        annotation.articleText = parent.articleText;
        annotation.articleId = parent.articleId;
        annotation.groupIds = parent.groupIds;
        annotation.ancestors = parent.ancestors.concat([parent._id]);
        annotation.isPublic = parent.isPublic;
        return annotation.save();
      });
  } else {
    annotation.articleText = body.articleText;
    annotation.articleId = body.articleId;
    annotation.groupIds = body.groupIds;
    annotation.ancestors = [];
    annotation.isPublic = body.isPublic;
    return annotation.save();
  }
};


const intersectOIDArrays = (a, b) => {
  return a.filter(ael => {
    return b.map(bel => {
      return ael.equals(bel);
    }).some(x => { return x; });
  });
};

// direct access to a specific annotation
export const getAnnotation = (user, annotationId) => {
  const conditions = { _id: annotationId };
  if (user === null) {
    conditions.isPublic = true;
  } else {
    conditions.$or = [{ groupIds: { $in: user.groupIds } }, { isPublic: true }];
  }
  return Annotation.find(conditions);
};

// Get all annotations on an article, accessible by user, optionally in a specific set of groups
// If user is null, return public annotations.
// Returns a promise.
export const getArticleAnnotations = (user, articleId, toplevelOnly) => {
  const conditions = { articleId };
  if (user === null) {
    conditions.isPublic = true;
  } else {
    conditions.$or = [{ groupIds: { $in: user.groupIds } }, { isPublic: true }];
  }
  if (typeof toplevelOnly !== 'undefined' && toplevelOnly) {
    conditions.ancestors = { $size: 0 };
  }
  return Annotation.find(conditions);
};

// Get top-level annotations on an article, accessible by user, optionally in a specific set of groups
// Equivalent to getArticleAnnotations, but only returns annotations with no ancestors.
// Returns a promise.
export const getTopLevelAnnotations = (user, articleId) => {
  return getArticleAnnotations(user, articleId, true);
};

// Get all replies to parentId (verifying that user has access to this comment)
// Also succeeds if user is null and comment thread is public.
// Returns a promise.
export const getReplies = (user, articleId, parentId, directOnly) => {
  if (user === null) {
    // TODO: assign the appropriate public group
    var userGroups = [];
  } else {
    var userGroups = user.groupIds;
  }
  // check that the user has access
  return Annotations.findById(parentId)
    .then(parent => {
      if (intersectOIDArrays(parent.groupIds, userGroups).length === 0) {
        throw new Error('User does not have access to this annotation');
      }
      // user is authorized
      if (typeof directOnly == 'undefined' || !directOnly) {
        var conditions = {articleId: articleId, ancestors: {$in: [parentId]}};
      } else {
        var parentAncestors = parent.ancestors.length;
        var conditions = {$and: [{articleId: articleId},
                                 {ancestors: {$in: [parentId]}},
                                 {ancestors: {$size: parentAncestors + 1}}
                                ]
                          };
      }
      return Annotations.find(conditions).exec();
    });
};

// Get direct replies to parentId (verifying that user has access to this comment)
// Also succeeds if user is null and comment thread is public.
// Returns a promise.
export const getDirectReplies = (user, articleId, parentId) => {
  return getReplies(user, articleId, parentId, true);
}

export const editAnnotation = (req, res) => {
  if (req.isAuthenticated()) {
    const userId = req.user._id;
    Annotation.findById(req.params.id, 'authorId')
      .then(antn => {
        if (antn.authorId.equals(userId)) {
          // allow this edit
          var update = {};
          update.text = req.body.text;
          update.editDate = Date.now();
          Annotation.updateOne({_id: req.params.id}, update)
            .then(result => {
              res.json({ message: "Annotation " + req.params.id.valueOf() + " updated" });
            })
            .catch(err => {
              res.json({ err });
            })
        } else {
          // not the author - send 401 Unauthorized
          res.status(401).end();
        }
      })
      .catch(err => {
        res.json({ err });
      });
  } else {
    // not authenticated - send 401 Unauthorized
    res.status(401).end();
  }
};