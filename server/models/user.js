import mongoose, { Schema } from 'mongoose';
mongoose.Promise = global.Promise;
const ObjectId = Schema.Types.ObjectId;
import mongodb from 'mongodb';
import autopopulate from 'mongoose-autopopulate';

import Annotation from './annotation';
import Group from './group';

const NOTIFICATION_TYPES = ['reply'];

const userSchema = new Schema({
  googleId: String,
  facebookId: String,
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  bio: String,
  groups: [{ type: ObjectId, ref: 'Group' }],
  usersIFollow: [{ type: ObjectId, ref: 'User' }],
  usersFollowingMe: [{ type: ObjectId, ref: 'User' }],
  exploreNumber: { type: Number, default: 0 },
  numExplorations: { type: Number, default: 0 },
  exploreStandardDev: Number,
  notifications: [{
    type: { type: String, required: true, validate: (type) => NOTIFICATION_TYPES.includes(type) },
    sender: { type: ObjectId, ref: 'User', autopopulate: { select: 'name' } },
    createDate: { type: Date, default: Date.now },
    isNew: { type: Boolean, default: true },
    href: String,
  }],
});

userSchema.virtual('articles').get(function getUserArticles() {
  // get annotations
  return Annotation.distinct('article', { author: this });
});

userSchema.virtual('annotations').get(function getUserAnnotations() {
  return Annotation.find({ author: this }).then((annotations) => {
    return annotations;
  });
});

userSchema.methods.isMemberOf = function isMemberOf(groupIdIn) {
  let groupId = groupIdIn;
  if (typeof groupId !== 'object') {
    groupId = new mongodb.ObjectId(groupIdIn);
  }
  return this.groups.some((someGroup) => {
    return someGroup.equals(groupId);
  });
};

userSchema.methods.isMemberOfAll = function isMemberOfAll(groupIds) {
  return groupIds.every(this.isMemberOf, this);
};

userSchema.methods.isMemberOfAny = function isMemberOfAny(groupIds) {
  return groupIds.some(this.isMemberOf, this);
};

userSchema.pre('save', function preSave(next) {
  // Add user's hard-coded groups
  if (this.groups.length === 0) {
    this.groups.push('59127637f0717e001cbfe583'); // US Politics
    Group.findOneAndUpdate({ _id: '59127637f0717e001cbfe583' }, { $push: { members: this._id } }, { new: true }).exec();

    this.groups.push('59127895f0717e001cbfe584'); // Random
    Group.findOneAndUpdate({ _id: '59127895f0717e001cbfe584' }, { $push: { members: this._id } }, { new: true }).exec();

    this.groups.push('59127908f0717e001cbfe585'); // World News
    Group.findOneAndUpdate({ _id: '59127908f0717e001cbfe585' }, { $push: { members: this._id } }, { new: true }).exec();

    this.groups.push('591279ecf0717e001cbfe586'); // Opinion
    Group.findOneAndUpdate({ _id: '591279ecf0717e001cbfe586' }, { $push: { members: this._id } }, { new: true }).exec();
  }
  next();
});

userSchema.plugin(autopopulate);

const UserModel = mongoose.model('User', userSchema);

export default UserModel;
