import Annotation from '../models/annotation';

// direct access to a specific annotation
export const getAnnotation = (user, annotationId) => {
  return Annotation.findById(annotationId)
    .then(annotation => {
      if (annotation === null) {
        throw new Error('Annotation not found');
      }

      let isAuthorized = annotation.isPublic;
      if (user !== null) {
        isAuthorized = isAuthorized || user.isMemberOfAny(annotation.groups);
      }

      if (!isAuthorized) {
        throw new Error('Not authorized to access this annotation');
      }

      return annotation;
    });
};

// PRECONDITION: user is not null.
export const createAnnotation = (user, body, articleId) => {
  const annotation = new Annotation();
  annotation.author = user._id;
  annotation.username = user.username;
  annotation.text = body.text;
  if (body.parent) {
    // ensure user is allowed to *read* the parent annotation
    return getAnnotation(user, body.parent)
      .then(parent => { // inherit properties from parent
        annotation.parent = parent._id;
        annotation.articleText = parent.articleText;
        annotation.article = parent.article;
        annotation.groups = parent.groups;
        annotation.isPublic = parent.isPublic;
        return annotation.save();
      })
      .catch(err => {
        const newErr = err;
        newErr.message = `Error getting parent: ${err.message}`;
        throw newErr;
      });
  } else {
    annotation.articleText = body.articleText;
    annotation.ranges = body.ranges;
    annotation.parent = null;
    annotation.article = articleId;
    annotation.isPublic = body.isPublic;
    annotation.groups = body.groups || [];
    if (!annotation.isPublic && annotation.groups.length > 1) {
      const err = new Error('Cannot assign private annotation to multiple groups');
      return Promise.reject(err);
    }

    // check that user is allowed to post to the groups
    if (!user.isMemberOfAll(annotation.groups)) {
      const err = new Error('Not authorized to post to these groups');
      return Promise.reject(err);
    } else {
      Articles.addArticleGroups(annotation.article, annotation.groups);
    }
    return annotation.save();
  }
};

// Get all replies to parentId (verifying that user has access to this comment)
// Also succeeds if user is null and comment thread is public.
// Returns a promise.
export const getReplies = (user, parentId) => {
  const conditions = { parent: parentId };

  if (user === null) {
    conditions.isPublic = true;
  } else {
    conditions.$or = [{ groups: { $in: user.groups } }, { isPublic: true }];
  }
  return Annotation.find(conditions);
};

// PRECONDITION: user is not null.
export const editAnnotation = (userId, annotationId, updateText) => {
  const conditions = { _id: annotationId, authorId: userId };
  const update = { $set: { text: updateText, editDate: Date.now(), edited: true } };
  return Annotation.findOneAndUpdate(conditions, update, { new: true });
};
